// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LeaseManager.sol";
import "../src/MockUSDC.sol";
import "../src/interfaces/INameWrapper.sol";
import "../src/interfaces/IPublicResolver.sol";

// ─── Mock NameWrapper ────────────────────────────────────────────
contract MockNameWrapper is INameWrapper {
    mapping(uint256 => address) public owners;
    mapping(address => mapping(address => bool)) public approvals;

    // Track calls for assertions
    bytes32 public lastParentNode;
    string  public lastLabel;
    address public lastOwner;
    address public lastResolver;

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64,  // ttl
        uint32,  // fuses
        uint64   // expiry
    ) external returns (bytes32) {
        bytes32 node = _makeNode(parentNode, label);
        owners[uint256(node)] = owner;
        lastParentNode = parentNode;
        lastLabel = label;
        lastOwner = owner;
        lastResolver = resolver;
        return node;
    }

    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address newOwner,
        uint32,  // fuses
        uint64   // expiry
    ) external returns (bytes32) {
        bytes32 node = _makeNode(parentNode, label);
        owners[uint256(node)] = newOwner;
        lastParentNode = parentNode;
        lastLabel = label;
        lastOwner = newOwner;
        return node;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return owners[id];
    }

    function getData(uint256 id) external view returns (address, uint32, uint64) {
        return (owners[id], 0, 0);
    }

    function setApprovalForAll(address operator, bool approved) external {
        approvals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return approvals[account][operator];
    }

    function _makeNode(bytes32 parentNode, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
    }
}

// ─── Mock PublicResolver ─────────────────────────────────────────
contract MockPublicResolver is IPublicResolver {
    mapping(bytes32 => mapping(string => string)) public texts;
    mapping(bytes32 => address) public addrs;

    function setText(bytes32 node, string calldata key, string calldata value) external {
        texts[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }

    function setAddr(bytes32 node, address _addr) external {
        addrs[node] = _addr;
    }

    function addr(bytes32 node) external view returns (address) {
        return addrs[node];
    }
}

// ─── Test Contract ───────────────────────────────────────────────
contract LeaseManagerTest is Test {
    // Re-declare events for expectEmit (Solidity 0.8.20 doesn't support ContractType.EventName)
    event LeaseCreated(
        uint256 indexed leaseId, bytes32 indexed parentNode,
        bytes32 leaseNode, string label, address owner, address tenant,
        uint256 rentAmount, uint256 startDate, uint256 endDate
    );
    event RentPaid(
        uint256 indexed leaseId, address indexed tenant,
        uint256 rentAmount, uint256 penaltyPaid, uint256 newDueDate
    );
    event PenaltyAccrued(uint256 indexed leaseId, uint256 penaltyAmount, uint256 totalAccrued);
    event LeaseTerminated(uint256 indexed leaseId, address indexed terminatedBy, string reason);
    event OwnerRegistered(bytes32 indexed parentNode, bytes32 ownerNode, string label, address ownerAddress);

    LeaseManager    public leaseManager;
    MockUSDC        public usdc;
    MockNameWrapper public nameWrapper;
    MockPublicResolver public resolver;

    address public pm     = makeAddr("propertyManager");
    address public owner1 = makeAddr("owner1");
    address public tenant1 = makeAddr("tenant1");
    address public tenant2 = makeAddr("tenant2");

    bytes32 public constant PARENT_NODE = keccak256("residence-epfl.eth");
    uint256 public constant RENT_AMOUNT = 1500 * 1e6; // 1500 USDC
    uint256 public constant DURATION_MONTHS = 12;
    uint256 public constant PENALTY_BPS = 50; // 0.5% per day

    function setUp() public {
        // Warp to a realistic timestamp to avoid underflow in time arithmetic
        vm.warp(1700000000); // Nov 2023

        nameWrapper = new MockNameWrapper();
        resolver    = new MockPublicResolver();
        usdc        = new MockUSDC();

        leaseManager = new LeaseManager(
            address(nameWrapper),
            address(resolver),
            address(usdc),
            address(this)  // test contract is the backend wallet
        );
    }

    // ─── Helper: create a standard lease ─────────────────────────
    function _createStandardLease() internal returns (uint256 leaseId) {
        vm.prank(owner1);
        leaseId = leaseManager.createLease(
            PARENT_NODE,
            "apt1",
            tenant1,
            RENT_AMOUNT,
            DURATION_MONTHS,
            PENALTY_BPS
        );
    }

    function _fundAndApproveTenant(address tenant, uint256 amount) internal {
        usdc.mint(tenant, amount);
        vm.prank(tenant);
        usdc.approve(address(leaseManager), amount);
    }

    // ═══════════════════════════════════════════════════════════════
    // Constructor tests
    // ═══════════════════════════════════════════════════════════════
    function test_constructor() public view {
        assertEq(address(leaseManager.nameWrapper()), address(nameWrapper));
        assertEq(address(leaseManager.publicResolver()), address(resolver));
        assertEq(address(leaseManager.paymentToken()), address(usdc));
    }

    // ═══════════════════════════════════════════════════════════════
    // registerOwner tests
    // ═══════════════════════════════════════════════════════════════
    function test_registerOwner_success() public {
        vm.prank(pm);
        bytes32 ownerNode = leaseManager.registerOwner(PARENT_NODE, "dupont", owner1);

        // Verify text records were set
        assertEq(resolver.text(ownerNode, "role"), "owner");
        // Verify addr record was set
        assertEq(resolver.addrs(ownerNode), owner1);
        // Verify ownership was transferred to owner
        assertEq(nameWrapper.ownerOf(uint256(ownerNode)), owner1);
    }

    function test_registerOwner_emitsEvent() public {
        bytes32 expectedNode = keccak256(abi.encodePacked(PARENT_NODE, keccak256("dupont")));

        vm.expectEmit(true, false, false, true);
        emit OwnerRegistered(PARENT_NODE, expectedNode, "dupont", owner1);

        vm.prank(pm);
        leaseManager.registerOwner(PARENT_NODE, "dupont", owner1);
    }

    function test_registerOwner_setsOwnerLabel() public {
        vm.prank(pm);
        bytes32 ownerNode = leaseManager.registerOwner(PARENT_NODE, "dupont", owner1);
        assertEq(leaseManager.ownerLabels(ownerNode), "dupont");
    }

    function test_registerOwner_revertsZeroAddress() public {
        vm.prank(pm);
        vm.expectRevert("Invalid owner");
        leaseManager.registerOwner(PARENT_NODE, "dupont", address(0));
    }

    // ═══════════════════════════════════════════════════════════════
    // createLease tests
    // ═══════════════════════════════════════════════════════════════
    function test_createLease_success() public {
        uint256 leaseId = _createStandardLease();

        assertEq(leaseId, 0);
        assertEq(leaseManager.leaseCount(), 1);

        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertEq(lease.parentNode, PARENT_NODE);
        assertEq(lease.owner, owner1);
        assertEq(lease.tenant, tenant1);
        assertEq(lease.rentAmount, RENT_AMOUNT);
        assertEq(lease.penaltyBps, PENALTY_BPS);
        assertTrue(lease.active);
        assertEq(lease.startDate, block.timestamp);
        assertEq(lease.endDate, block.timestamp + (DURATION_MONTHS * 30 days));
        assertEq(lease.nextDueDate, block.timestamp + 30 days);
        assertEq(lease.accruedPenalty, 0);
    }

    function test_createLease_setsENSRecords() public {
        uint256 leaseId = _createStandardLease();
        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);

        // Verify text records
        assertEq(resolver.text(lease.leaseNode, "lease.token"), "USDC");
        assertEq(resolver.text(lease.leaseNode, "lease.status"), "active");
        // Verify addr record points to tenant
        assertEq(resolver.addrs(lease.leaseNode), tenant1);
    }

    function test_createLease_emitsEvent() public {
        bytes32 expectedLeaseNode = keccak256(abi.encodePacked(PARENT_NODE, keccak256("apt1")));

        vm.expectEmit(true, true, false, true);
        emit LeaseCreated(
            0, PARENT_NODE, expectedLeaseNode, "apt1",
            owner1, tenant1, RENT_AMOUNT, block.timestamp,
            block.timestamp + (DURATION_MONTHS * 30 days)
        );

        vm.prank(owner1);
        leaseManager.createLease(PARENT_NODE, "apt1", tenant1, RENT_AMOUNT, DURATION_MONTHS, PENALTY_BPS);
    }

    function test_createLease_multipleLeases() public {
        _createStandardLease();

        vm.prank(owner1);
        uint256 leaseId2 = leaseManager.createLease(
            PARENT_NODE, "apt2", tenant2, 2000e6, 6, 100
        );

        assertEq(leaseId2, 1);
        assertEq(leaseManager.leaseCount(), 2);
    }

    function test_createLease_revertsZeroTenant() public {
        vm.prank(owner1);
        vm.expectRevert("Invalid tenant");
        leaseManager.createLease(PARENT_NODE, "apt1", address(0), RENT_AMOUNT, DURATION_MONTHS, PENALTY_BPS);
    }

    function test_createLease_revertsZeroRent() public {
        vm.prank(owner1);
        vm.expectRevert("Rent must be > 0");
        leaseManager.createLease(PARENT_NODE, "apt1", tenant1, 0, DURATION_MONTHS, PENALTY_BPS);
    }

    function test_createLease_revertsZeroDuration() public {
        vm.prank(owner1);
        vm.expectRevert("Duration must be > 0");
        leaseManager.createLease(PARENT_NODE, "apt1", tenant1, RENT_AMOUNT, 0, PENALTY_BPS);
    }

    function test_createLease_revertsExcessivePenalty() public {
        vm.prank(owner1);
        vm.expectRevert("Max 10%/day");
        leaseManager.createLease(PARENT_NODE, "apt1", tenant1, RENT_AMOUNT, DURATION_MONTHS, 1001);
    }

    function test_createLease_maxPenaltyAllowed() public {
        vm.prank(owner1);
        uint256 leaseId = leaseManager.createLease(PARENT_NODE, "apt1", tenant1, RENT_AMOUNT, DURATION_MONTHS, 1000);
        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertEq(lease.penaltyBps, 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    // payRent tests
    // ═══════════════════════════════════════════════════════════════
    function test_payRent_success() public {
        uint256 leaseId = _createStandardLease();
        _fundAndApproveTenant(tenant1, RENT_AMOUNT);

        vm.prank(tenant1);
        leaseManager.payRent(leaseId);

        // Verify payment recorded
        (uint256[] memory timestamps, uint256[] memory amounts) = leaseManager.getPaymentHistory(leaseId);
        assertEq(timestamps.length, 1);
        assertEq(amounts.length, 1);
        assertEq(amounts[0], RENT_AMOUNT);

        // Verify due date advanced
        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertEq(lease.nextDueDate, block.timestamp + 60 days); // original + 30 + 30

        // Verify USDC transferred
        assertEq(usdc.balanceOf(owner1), RENT_AMOUNT);
        assertEq(usdc.balanceOf(tenant1), 0);
    }

    function test_payRent_updatesENSTextRecord() public {
        uint256 leaseId = _createStandardLease();
        _fundAndApproveTenant(tenant1, RENT_AMOUNT);

        vm.prank(tenant1);
        leaseManager.payRent(leaseId);

        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        string memory lastPaid = resolver.text(lease.leaseNode, "lease.lastPaid");
        // Should be non-empty (the current block.timestamp as string)
        assertTrue(bytes(lastPaid).length > 0);
    }

    function test_payRent_emitsEvent() public {
        uint256 leaseId = _createStandardLease();
        _fundAndApproveTenant(tenant1, RENT_AMOUNT);

        vm.expectEmit(true, true, false, true);
        emit RentPaid(
            leaseId, tenant1, RENT_AMOUNT, 0,
            block.timestamp + 60 days // nextDueDate after payment
        );

        vm.prank(tenant1);
        leaseManager.payRent(leaseId);
    }

    function test_payRent_multiplePayments() public {
        uint256 leaseId = _createStandardLease();

        // First payment
        _fundAndApproveTenant(tenant1, RENT_AMOUNT);
        vm.prank(tenant1);
        leaseManager.payRent(leaseId);

        // Second payment (advance time to next month)
        vm.warp(block.timestamp + 30 days);
        _fundAndApproveTenant(tenant1, RENT_AMOUNT);
        vm.prank(tenant1);
        leaseManager.payRent(leaseId);

        (uint256[] memory timestamps, uint256[] memory amounts) = leaseManager.getPaymentHistory(leaseId);
        assertEq(timestamps.length, 2);
        assertEq(amounts.length, 2);
    }

    function test_payRent_revertsInactiveLease() public {
        uint256 leaseId = _createStandardLease();

        // Terminate first
        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "end of lease");

        _fundAndApproveTenant(tenant1, RENT_AMOUNT);
        vm.prank(tenant1);
        vm.expectRevert("Lease not active");
        leaseManager.payRent(leaseId);
    }

    function test_payRent_revertsNonTenant() public {
        uint256 leaseId = _createStandardLease();
        _fundAndApproveTenant(tenant2, RENT_AMOUNT);

        vm.prank(tenant2);
        vm.expectRevert("Only tenant can pay");
        leaseManager.payRent(leaseId);
    }

    function test_payRent_revertsExpiredLease() public {
        uint256 leaseId = _createStandardLease();

        // Warp past end date
        vm.warp(block.timestamp + (DURATION_MONTHS * 30 days) + 1);

        _fundAndApproveTenant(tenant1, RENT_AMOUNT * 2);
        vm.prank(tenant1);
        vm.expectRevert("Lease expired");
        leaseManager.payRent(leaseId);
    }

    function test_payRent_withPenalty() public {
        uint256 leaseId = _createStandardLease();

        // Warp 5 days past due date
        vm.warp(block.timestamp + 30 days + 5 days);

        // penalty = 1500e6 * 50 * 5 / 10000 = 37.5 USDC = 37500000
        uint256 expectedPenalty = (RENT_AMOUNT * PENALTY_BPS * 5) / 10000;
        uint256 totalDue = RENT_AMOUNT + expectedPenalty;

        _fundAndApproveTenant(tenant1, totalDue);

        vm.prank(tenant1);
        leaseManager.payRent(leaseId);

        assertEq(usdc.balanceOf(owner1), totalDue);

        (,uint256[] memory amounts) = leaseManager.getPaymentHistory(leaseId);
        assertEq(amounts[0], totalDue);
    }

    function test_payRent_withPenalty_emitsCorrectEvent() public {
        uint256 leaseId = _createStandardLease();

        // Warp 5 days past due date
        vm.warp(block.timestamp + 30 days + 5 days);

        uint256 expectedPenalty = (RENT_AMOUNT * PENALTY_BPS * 5) / 10000;
        uint256 totalDue = RENT_AMOUNT + expectedPenalty;
        _fundAndApproveTenant(tenant1, totalDue);

        LeaseManager.Lease memory leaseBefore = leaseManager.getLease(leaseId);
        uint256 expectedNextDue = leaseBefore.nextDueDate + 30 days;

        vm.expectEmit(true, true, false, true);
        emit RentPaid(leaseId, tenant1, RENT_AMOUNT, expectedPenalty, expectedNextDue);

        vm.prank(tenant1);
        leaseManager.payRent(leaseId);
    }

    function test_payRent_withAccruedPenalty() public {
        uint256 leaseId = _createStandardLease();

        // Warp 5 days past due
        vm.warp(block.timestamp + 30 days + 5 days);

        // Accrue penalty first
        leaseManager.accruePenalty(leaseId);

        LeaseManager.Lease memory leaseAfterAccrue = leaseManager.getLease(leaseId);
        uint256 accrued = leaseAfterAccrue.accruedPenalty;
        assertTrue(accrued > 0);

        // Now warp a bit more but still within new due window (next due = original + 60 days)
        // Pay before the new due date so no additional penalty
        uint256 totalDue = RENT_AMOUNT + accrued;
        _fundAndApproveTenant(tenant1, totalDue);

        vm.prank(tenant1);
        leaseManager.payRent(leaseId);

        // Accrued penalty should be cleared
        LeaseManager.Lease memory leaseAfterPay = leaseManager.getLease(leaseId);
        assertEq(leaseAfterPay.accruedPenalty, 0);
        assertEq(usdc.balanceOf(owner1), totalDue);
    }

    // ═══════════════════════════════════════════════════════════════
    // calculatePenalty tests
    // ═══════════════════════════════════════════════════════════════
    function test_calculatePenalty_noPenaltyBeforeDue() public {
        uint256 leaseId = _createStandardLease();
        assertEq(leaseManager.calculatePenalty(leaseId), 0);
    }

    function test_calculatePenalty_noPenaltyOnDueDate() public {
        uint256 leaseId = _createStandardLease();
        vm.warp(block.timestamp + 30 days);
        assertEq(leaseManager.calculatePenalty(leaseId), 0);
    }

    function test_calculatePenalty_oneDayLate() public {
        uint256 leaseId = _createStandardLease();
        vm.warp(block.timestamp + 30 days + 1 days);

        uint256 expected = (RENT_AMOUNT * PENALTY_BPS * 1) / 10000;
        assertEq(leaseManager.calculatePenalty(leaseId), expected);
    }

    function test_calculatePenalty_cappedAtRentAmount() public {
        uint256 leaseId = _createStandardLease();
        // 50 bps/day * 200+ days = way over 100%
        vm.warp(block.timestamp + 30 days + 300 days);

        // Should cap at rent amount
        assertEq(leaseManager.calculatePenalty(leaseId), RENT_AMOUNT);
    }

    function test_calculatePenalty_inactiveLease() public {
        uint256 leaseId = _createStandardLease();

        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "done");

        vm.warp(block.timestamp + 60 days);
        assertEq(leaseManager.calculatePenalty(leaseId), 0);
    }

    function test_calculatePenalty_partialDayNotCounted() public {
        uint256 leaseId = _createStandardLease();
        // 30 days + 12 hours (less than 1 full day late)
        vm.warp(block.timestamp + 30 days + 12 hours);

        assertEq(leaseManager.calculatePenalty(leaseId), 0);
    }

    // ═══════════════════════════════════════════════════════════════
    // accruePenalty tests
    // ═══════════════════════════════════════════════════════════════
    function test_accruePenalty_success() public {
        uint256 leaseId = _createStandardLease();
        vm.warp(block.timestamp + 30 days + 5 days);

        uint256 expectedPenalty = (RENT_AMOUNT * PENALTY_BPS * 5) / 10000;

        vm.expectEmit(true, false, false, true);
        emit PenaltyAccrued(leaseId, expectedPenalty, expectedPenalty);

        leaseManager.accruePenalty(leaseId);

        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertEq(lease.accruedPenalty, expectedPenalty);
        // Due date should advance by one month
        assertEq(lease.nextDueDate, block.timestamp - 5 days + 30 days);
    }

    function test_accruePenalty_noPenaltyNoop() public {
        uint256 leaseId = _createStandardLease();
        // No time passed, no penalty
        leaseManager.accruePenalty(leaseId);

        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertEq(lease.accruedPenalty, 0);
    }

    function test_accruePenalty_revertsInactive() public {
        uint256 leaseId = _createStandardLease();
        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "done");

        vm.expectRevert("Lease not active");
        leaseManager.accruePenalty(leaseId);
    }

    // ═══════════════════════════════════════════════════════════════
    // setDueDateForDemo tests
    // ═══════════════════════════════════════════════════════════════
    function test_setDueDateForDemo_success() public {
        uint256 leaseId = _createStandardLease();
        uint256 newDue = block.timestamp - 10 days;

        vm.prank(owner1);
        leaseManager.setDueDateForDemo(leaseId, newDue);

        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertEq(lease.nextDueDate, newDue);
    }

    function test_setDueDateForDemo_revertsNonOwner() public {
        uint256 leaseId = _createStandardLease();

        vm.prank(tenant1);
        vm.expectRevert("Only owner");
        leaseManager.setDueDateForDemo(leaseId, block.timestamp);
    }

    function test_setDueDateForDemo_revertsInactive() public {
        uint256 leaseId = _createStandardLease();
        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "done");

        vm.prank(owner1);
        vm.expectRevert("Lease not active");
        leaseManager.setDueDateForDemo(leaseId, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    // terminateLease tests
    // ═══════════════════════════════════════════════════════════════
    function test_terminateLease_success() public {
        uint256 leaseId = _createStandardLease();

        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "lease ended");

        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertFalse(lease.active);

        // Verify subname owner set to address(0)
        bytes32 leaseNode = lease.leaseNode;
        assertEq(nameWrapper.ownerOf(uint256(leaseNode)), address(0));
    }

    function test_terminateLease_emitsEvent() public {
        uint256 leaseId = _createStandardLease();

        vm.expectEmit(true, true, false, true);
        emit LeaseTerminated(leaseId, owner1, "eviction");

        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "eviction");
    }

    function test_terminateLease_revertsNonOwner() public {
        uint256 leaseId = _createStandardLease();

        vm.prank(tenant1);
        vm.expectRevert("Only owner");
        leaseManager.terminateLease(leaseId, "reason");
    }

    function test_terminateLease_revertsAlreadyTerminated() public {
        uint256 leaseId = _createStandardLease();

        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "first");

        vm.prank(owner1);
        vm.expectRevert("Lease not active");
        leaseManager.terminateLease(leaseId, "second");
    }

    // ═══════════════════════════════════════════════════════════════
    // View function tests
    // ═══════════════════════════════════════════════════════════════
    function test_getLease() public {
        uint256 leaseId = _createStandardLease();
        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertEq(lease.tenant, tenant1);
        assertEq(lease.owner, owner1);
    }

    function test_getTotalDue_noPenalty() public {
        uint256 leaseId = _createStandardLease();
        assertEq(leaseManager.getTotalDue(leaseId), RENT_AMOUNT);
    }

    function test_getTotalDue_withPenalty() public {
        uint256 leaseId = _createStandardLease();
        vm.warp(block.timestamp + 30 days + 3 days);

        uint256 penalty = (RENT_AMOUNT * PENALTY_BPS * 3) / 10000;
        assertEq(leaseManager.getTotalDue(leaseId), RENT_AMOUNT + penalty);
    }

    function test_getTotalDue_inactiveReturnsZero() public {
        uint256 leaseId = _createStandardLease();

        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "done");

        assertEq(leaseManager.getTotalDue(leaseId), 0);
    }

    function test_getPaymentHistory_empty() public {
        uint256 leaseId = _createStandardLease();
        (uint256[] memory timestamps, uint256[] memory amounts) = leaseManager.getPaymentHistory(leaseId);
        assertEq(timestamps.length, 0);
        assertEq(amounts.length, 0);
    }

    function test_getOwnerLeases() public {
        _createStandardLease(); // leaseId 0

        vm.prank(owner1);
        leaseManager.createLease(PARENT_NODE, "apt2", tenant2, 2000e6, 6, 100); // leaseId 1

        uint256[] memory ownerLeases = leaseManager.getOwnerLeases(owner1);
        assertEq(ownerLeases.length, 2);
        assertEq(ownerLeases[0], 0);
        assertEq(ownerLeases[1], 1);
    }

    function test_getOwnerLeases_excludesTerminated() public {
        uint256 leaseId = _createStandardLease();

        vm.prank(owner1);
        leaseManager.createLease(PARENT_NODE, "apt2", tenant2, 2000e6, 6, 100);

        // Terminate first lease
        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "done");

        uint256[] memory ownerLeases = leaseManager.getOwnerLeases(owner1);
        assertEq(ownerLeases.length, 1);
        assertEq(ownerLeases[0], 1);
    }

    function test_getOwnerLeases_empty() public view {
        uint256[] memory ownerLeases = leaseManager.getOwnerLeases(owner1);
        assertEq(ownerLeases.length, 0);
    }

    function test_getTenantLeases() public {
        _createStandardLease();

        uint256[] memory tenantLeases = leaseManager.getTenantLeases(tenant1);
        assertEq(tenantLeases.length, 1);
        assertEq(tenantLeases[0], 0);
    }

    function test_getTenantLeases_excludesTerminated() public {
        uint256 leaseId = _createStandardLease();

        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "done");

        uint256[] memory tenantLeases = leaseManager.getTenantLeases(tenant1);
        assertEq(tenantLeases.length, 0);
    }

    
    function test_setPersonaVerified_success() public {
        bytes32 node = keccak256("apt1.dupont.residence-epfl.eth");

        // Backend wallet in this suite is address(this), set in setUp().
        leaseManager.setPersonaVerified(node);

        assertEq(resolver.text(node, "persona.verified"), "true");
        string memory timestamp = resolver.text(node, "persona.timestamp");
        assertTrue(bytes(timestamp).length > 0);
    }

    function test_setPersonaVerified_revertsNonBackend() public {
        bytes32 node = keccak256("apt1.dupont.residence-epfl.eth");

        vm.prank(owner1);
        vm.expectRevert("Only backend wallet");
        leaseManager.setPersonaVerified(node);
    }

    // ═══════════════════════════════════════════════════════════════
    // MockUSDC tests
    // ═══════════════════════════════════════════════════════════════
    function test_mockUSDC_decimals() public view {
        assertEq(usdc.decimals(), 6);
    }

    function test_mockUSDC_nameAndSymbol() public view {
        assertEq(usdc.name(), "USD Coin");
        assertEq(usdc.symbol(), "USDC");
    }

    function test_mockUSDC_mint() public {
        usdc.mint(tenant1, 1000e6);
        assertEq(usdc.balanceOf(tenant1), 1000e6);
    }

    // ═══════════════════════════════════════════════════════════════
    // ERC1155Holder (contract can receive NameWrapper tokens)
    // ═══════════════════════════════════════════════════════════════
    function test_supportsERC1155Interface() public view {
        // ERC1155Receiver interface ID = 0x4e2312e0
        assertTrue(leaseManager.supportsInterface(0x4e2312e0));
    }

    // ═══════════════════════════════════════════════════════════════
    // Integration / end-to-end flow
    // ═══════════════════════════════════════════════════════════════
    function test_fullLifecycle() public {
        // 1. Register owner
        vm.prank(pm);
        bytes32 ownerNode = leaseManager.registerOwner(PARENT_NODE, "dupont", owner1);
        assertEq(nameWrapper.ownerOf(uint256(ownerNode)), owner1);

        // 2. Create lease
        vm.prank(owner1);
        uint256 leaseId = leaseManager.createLease(
            ownerNode, "apt1", tenant1, RENT_AMOUNT, 12, PENALTY_BPS
        );

        // 3. Pay rent on time
        _fundAndApproveTenant(tenant1, RENT_AMOUNT);
        vm.prank(tenant1);
        leaseManager.payRent(leaseId);
        assertEq(usdc.balanceOf(owner1), RENT_AMOUNT);

        // 4. Simulate late payment via demo helper
        vm.prank(owner1);
        leaseManager.setDueDateForDemo(leaseId, block.timestamp - 10 days);

        // 5. Check penalty
        uint256 penalty = leaseManager.calculatePenalty(leaseId);
        assertTrue(penalty > 0);

        // 6. Pay with penalty
        uint256 totalDue = leaseManager.getTotalDue(leaseId);
        _fundAndApproveTenant(tenant1, totalDue);
        vm.prank(tenant1);
        leaseManager.payRent(leaseId);

        // 7. Terminate lease
        vm.prank(owner1);
        leaseManager.terminateLease(leaseId, "end of contract");

        LeaseManager.Lease memory lease = leaseManager.getLease(leaseId);
        assertFalse(lease.active);

        // Verify subname deleted
        assertEq(nameWrapper.ownerOf(uint256(lease.leaseNode)), address(0));
    }
}
