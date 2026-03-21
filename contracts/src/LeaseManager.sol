// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "./interfaces/INameWrapper.sol";
import "./interfaces/IPublicResolver.sol";

contract LeaseManager is ERC1155Holder {

    // ─── Constants ───────────────────────────────────────────────
    INameWrapper    public immutable nameWrapper;
    IPublicResolver public immutable publicResolver;
    IERC20          public immutable paymentToken;
    address         public immutable backendWallet; // for setPersonaVerified

    uint256 public constant MONTH           = 30 days;
    uint256 public constant MAX_PENALTY_BPS = 10000; // 100% of rent

    // ─── Storage ─────────────────────────────────────────────────
    struct Lease {
        bytes32 parentNode;       // namehash of owner's ENS name
        bytes32 leaseNode;        // namehash of the lease subname
        string  label;            // e.g. "apt1"
        address owner;            // rent recipient
        address tenant;           // rent payer
        uint256 rentAmount;       // monthly rent in token units (6 decimals)
        uint256 startDate;
        uint256 endDate;
        uint256 nextDueDate;
        uint256 penaltyBps;       // basis points per day late (e.g. 50 = 0.5%/day)
        uint256 accruedPenalty;
        bool    active;
    }

    mapping(uint256 => Lease)     public leases;
    uint256                       public leaseCount;
    mapping(uint256 => uint256[]) public paymentTimestamps;
    mapping(uint256 => uint256[]) public paymentAmounts;

    // ─── Events ──────────────────────────────────────────────────
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
    event PersonaVerified(bytes32 indexed node, uint256 timestamp);

    // ─── Modifiers ─────────────────────────────────────────────
    modifier onlyBackend() {
        require(msg.sender == backendWallet, "Only backend wallet");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────
    constructor(address _nameWrapper, address _publicResolver, address _paymentToken, address _backendWallet) {
        nameWrapper    = INameWrapper(_nameWrapper);
        publicResolver = IPublicResolver(_publicResolver);
        paymentToken   = IERC20(_paymentToken);
        backendWallet  = _backendWallet;
    }

    // ─── Owner Onboarding (P2) ───────────────────────────────────
    /// @notice PM creates an owner subname (e.g. dupont.residence-epfl.eth)
    /// @dev PM must have called nameWrapper.setApprovalForAll(address(this), true) first.
    ///      After this call, the owner wallet must ALSO call setApprovalForAll so
    ///      the LeaseManager can create lease subnames under the owner's name.
    function registerOwner(
        bytes32 parentNode,
        string calldata label,
        address ownerAddress
    ) external returns (bytes32 ownerNode) {
        require(ownerAddress != address(0), "Invalid owner");
        uint64 expiry = uint64(block.timestamp + 365 days);

        // Create subname with this contract as temp owner to set text records
        ownerNode = nameWrapper.setSubnodeRecord(
            parentNode, label, address(this), address(publicResolver), 0, 0, expiry
        );

        publicResolver.setAddr(ownerNode, ownerAddress);
        publicResolver.setText(ownerNode, "role", "owner");
        publicResolver.setText(ownerNode, "owner.address", _addr2str(ownerAddress));

        // Transfer ownership to actual owner wallet
        nameWrapper.setSubnodeOwner(parentNode, label, ownerAddress, 0, expiry);

        emit OwnerRegistered(parentNode, ownerNode, label, ownerAddress);
    }

    // ─── Lease Creation (P0) ─────────────────────────────────────
    /// @notice Owner creates a lease and mints an ENS subname for the tenant.
    /// @dev Owner must have called nameWrapper.setApprovalForAll(address(this), true) first.
    ///      The contract retains subname ownership permanently (Option A) so it can
    ///      always update text records (e.g. lease.status after payment/termination).
    function createLease(
        bytes32 parentNode,
        string calldata label,
        address tenant,
        uint256 rentAmount,
        uint256 durationMonths,
        uint256 penaltyBps
    ) external returns (uint256 leaseId) {
        require(tenant != address(0), "Invalid tenant");
        require(rentAmount > 0, "Rent must be > 0");
        require(durationMonths > 0, "Duration must be > 0");
        require(penaltyBps <= 1000, "Max 10%/day");

        leaseId = leaseCount++;
        uint256 startDate = block.timestamp;
        uint256 endDate   = startDate + (durationMonths * MONTH);

        // Step 1: Mint subname — contract keeps ownership permanently
        bytes32 leaseNode = nameWrapper.setSubnodeRecord(
            parentNode,
            label,
            address(this),            // Contract = permanent owner
            address(publicResolver),
            0,
            0,                        // No fuses burned: parent retains PARENT_CANNOT_CONTROL
            uint64(endDate + 365 days)
        );

        // Step 2: Set text records (we can do this because we own the subname)
        publicResolver.setText(leaseNode, "lease.rentAmount", _uint2str(rentAmount));
        publicResolver.setText(leaseNode, "lease.token",      "USDC");
        publicResolver.setText(leaseNode, "lease.startDate",  _uint2str(startDate));
        publicResolver.setText(leaseNode, "lease.endDate",    _uint2str(endDate));
        publicResolver.setText(leaseNode, "lease.status",     "active");
        publicResolver.setText(leaseNode, "lease.tenant",     _addr2str(tenant));

        // Step 3: Set addr record to tenant (name resolves to tenant's wallet)
        publicResolver.setAddr(leaseNode, tenant);

        // Step 4: Store lease data
        leases[leaseId] = Lease({
            parentNode:     parentNode,
            leaseNode:      leaseNode,
            label:          label,
            owner:          msg.sender,
            tenant:         tenant,
            rentAmount:     rentAmount,
            startDate:      startDate,
            endDate:        endDate,
            nextDueDate:    startDate + MONTH,
            penaltyBps:     penaltyBps,
            accruedPenalty: 0,
            active:         true
        });

        emit LeaseCreated(leaseId, parentNode, leaseNode, label,
            msg.sender, tenant, rentAmount, startDate, endDate);
    }

    // ─── Rent Payment (P0) ───────────────────────────────────────
    /// @notice Tenant pays rent for a lease.
    /// @dev Tenant must approve this contract to spend paymentToken before calling.
    ///      Handles penalty calculation, USDC transfer, due date advancement,
    ///      and ENS text record update.
    function payRent(uint256 leaseId) external {
        Lease storage lease = leases[leaseId];
        require(lease.active,                     "Lease not active");
        require(msg.sender == lease.tenant,        "Only tenant can pay");
        require(block.timestamp <= lease.endDate,  "Lease expired");

        uint256 penalty  = calculatePenalty(leaseId);
        uint256 totalDue = lease.rentAmount + penalty + lease.accruedPenalty;

        require(
            paymentToken.transferFrom(msg.sender, lease.owner, totalDue),
            "Payment failed"
        );

        paymentTimestamps[leaseId].push(block.timestamp);
        paymentAmounts[leaseId].push(totalDue);

        lease.accruedPenalty = 0;
        lease.nextDueDate    = lease.nextDueDate + MONTH;

        // Update text record — possible because contract owns the subname
        publicResolver.setText(lease.leaseNode, "lease.lastPaid", _uint2str(block.timestamp));

        emit RentPaid(leaseId, msg.sender, lease.rentAmount,
            penalty + lease.accruedPenalty, lease.nextDueDate);
    }

    // ─── Penalty (P1) ────────────────────────────────────────────
    /// @notice View-only: returns current penalty amount for a lease.
    ///         Formula: rentAmount * penaltyBps * daysLate / 10000, capped at 100% of rent.
    function calculatePenalty(uint256 leaseId) public view returns (uint256 penalty) {
        Lease storage lease = leases[leaseId];
        if (!lease.active || block.timestamp <= lease.nextDueDate) return 0;

        uint256 daysLate = (block.timestamp - lease.nextDueDate) / 1 days;
        if (daysLate == 0) return 0;

        penalty = (lease.rentAmount * lease.penaltyBps * daysLate) / 10000;
        if (penalty > lease.rentAmount) penalty = lease.rentAmount;
    }

    function accruePenalty(uint256 leaseId) external {
        Lease storage lease = leases[leaseId];
        require(lease.active, "Lease not active");
        uint256 penalty = calculatePenalty(leaseId);
        if (penalty > 0) {
            lease.accruedPenalty += penalty;
            lease.nextDueDate     = lease.nextDueDate + MONTH;
            emit PenaltyAccrued(leaseId, penalty, lease.accruedPenalty);
        }
    }

    /// @notice FOR DEMO ONLY — backdates the due date to simulate a late payment scenario
    function setDueDateForDemo(uint256 leaseId, uint256 newDueDate) external {
        require(leases[leaseId].active,              "Lease not active");
        require(msg.sender == leases[leaseId].owner, "Only owner");
        leases[leaseId].nextDueDate = newDueDate;
    }

    // ─── Termination (P1) ────────────────────────────────────────
    /// @notice Owner terminates a lease and deletes the ENS subname.
    /// @dev Sets subname owner to address(0) via NameWrapper — name stops resolving.
    ///      Works because fuses=0 was set on creation (parent retains PARENT_CANNOT_CONTROL).
    function terminateLease(uint256 leaseId, string calldata reason) external {
        Lease storage lease = leases[leaseId];
        require(lease.active,              "Lease not active");
        require(msg.sender == lease.owner, "Only owner");

        lease.active = false;

        nameWrapper.setSubnodeOwner(
            lease.parentNode,
            lease.label,
            address(0), // Delete: owner = zero address
            0,
            0
        );

        emit LeaseTerminated(leaseId, msg.sender, reason);
    }

    // ─── KYC (P2) ────────────────────────────────────────────────
    /// @notice Backend writes Persona verification to ENS text records.
    ///         Called by the backend wallet after mock KYC completes.
    ///         Works because the contract owns lease subnames permanently.
    function setPersonaVerified(bytes32 node) external onlyBackend {
        publicResolver.setText(node, "persona.verified",  "true");
        publicResolver.setText(node, "persona.timestamp", _uint2str(block.timestamp));
        emit PersonaVerified(node, block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────────
    function getLease(uint256 leaseId) external view returns (Lease memory) {
        return leases[leaseId];
    }

    function getTotalDue(uint256 leaseId) external view returns (uint256) {
        Lease storage lease = leases[leaseId];
        if (!lease.active) return 0;
        return lease.rentAmount + calculatePenalty(leaseId) + lease.accruedPenalty;
    }

    function getPaymentHistory(uint256 leaseId) external view
        returns (uint256[] memory timestamps, uint256[] memory amounts)
    {
        return (paymentTimestamps[leaseId], paymentAmounts[leaseId]);
    }

    function getOwnerLeases(address owner) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < leaseCount; i++)
            if (leases[i].owner == owner && leases[i].active) count++;
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < leaseCount; i++)
            if (leases[i].owner == owner && leases[i].active) result[idx++] = i;
        return result;
    }

    function getTenantLeases(address tenant) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < leaseCount; i++)
            if (leases[i].tenant == tenant && leases[i].active) count++;
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < leaseCount; i++)
            if (leases[i].tenant == tenant && leases[i].active) result[idx++] = i;
        return result;
    }

    // ─── Helpers ─────────────────────────────────────────────────
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value; uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _addr2str(address addr) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = "0"; s[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(uint160(addr) >> (8 * (19 - i)));
            s[2 + i * 2] = _hexChar(b >> 4);
            s[3 + i * 2] = _hexChar(b & 0x0f);
        }
        return string(s);
    }

    function _hexChar(uint8 value) internal pure returns (bytes1) {
        return value < 10 ? bytes1(uint8(48 + value)) : bytes1(uint8(87 + value));
    }
}
