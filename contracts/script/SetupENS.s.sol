// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/INameWrapper.sol";

contract SetupENS is Script {
    address constant NAME_WRAPPER = 0x0635513f179D50A207757E05759CbD106d7dFcE8;

    function run(address leaseManager) external {
        vm.startBroadcast();

        INameWrapper nameWrapper = INameWrapper(NAME_WRAPPER);
        nameWrapper.setApprovalForAll(leaseManager, true);

        console.log("Approved LeaseManager on NameWrapper:");
        console.log("  LeaseManager:", leaseManager);
        console.log("  NameWrapper: ", NAME_WRAPPER);

        vm.stopBroadcast();
    }
}
