// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/LeaseManager.sol";

contract Deploy is Script {
    address constant NAME_WRAPPER    = 0x0635513f179D50A207757E05759CbD106d7dFcE8;
    address constant PUBLIC_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;

    function run() external {
        vm.startBroadcast();

        MockUSDC usdc = new MockUSDC();
        LeaseManager leaseManager = new LeaseManager(
            NAME_WRAPPER,
            PUBLIC_RESOLVER,
            address(usdc),
            msg.sender  // deployer is the backend wallet
        );

        console.log("MockUSDC deployed at:     ", address(usdc));
        console.log("LeaseManager deployed at: ", address(leaseManager));

        vm.stopBroadcast();
    }
}
