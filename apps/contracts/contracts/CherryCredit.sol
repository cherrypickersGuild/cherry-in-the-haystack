// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CherryCredit
 * @notice Cherry KaaS 크레딧 관리 + 온체인 프로비넌스 기록
 *
 * 4개 핵심 함수:
 * - deposit()           : 에이전트 크레딧 충전
 * - consumeCredit()     : 지식 구매/팔로우 시 크레딧 차감
 * - distributeReward()  : 큐레이터 보상 분배
 * - recordProvenance()  : 지식 구매 영수증 온체인 기록
 *
 * 3개 이벤트:
 * - CreditConsumed      : 크레딧 차감 시 발생
 * - RewardDistributed   : 큐레이터 보상 시 발생
 * - ProvenanceRecorded  : 프로비넌스 기록 시 발생
 */
contract CherryCredit {
    // ═══════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════

    address public owner;
    address public authorizedServer;

    // agent address → credit balance
    mapping(address => uint256) public credits;

    // curator address → reward balance
    mapping(address => uint256) public rewards;

    // provenance hash → recorded flag
    mapping(bytes32 => bool) public provenanceExists;

    // ═══════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════

    event CreditDeposited(
        address indexed agent,
        uint256 amount,
        uint256 newBalance
    );

    event CreditConsumed(
        address indexed agent,
        uint256 amount,
        string conceptId,
        string actionType,
        uint256 remainingBalance
    );

    event RewardDistributed(
        address indexed curator,
        uint256 amount,
        string conceptId
    );

    event ProvenanceRecorded(
        bytes32 indexed hash,
        address indexed agent,
        string conceptId,
        uint256 timestamp
    );

    // ═══════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || msg.sender == authorizedServer,
            "Not authorized"
        );
        _;
    }

    // ═══════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════

    constructor(address _authorizedServer) {
        owner = msg.sender;
        authorizedServer = _authorizedServer;
    }

    // ═══════════════════════════════════════════
    // Functions
    // ═══════════════════════════════════════════

    /**
     * @notice 에이전트 크레딧 충전
     * @param agent 충전할 에이전트 주소
     * @param amount 충전 크레딧 양
     */
    function deposit(address agent, uint256 amount) external onlyAuthorized {
        require(agent != address(0), "Invalid agent address");
        require(amount > 0, "Amount must be > 0");

        credits[agent] += amount;

        emit CreditDeposited(agent, amount, credits[agent]);
    }

    /**
     * @notice 지식 구매/팔로우 시 크레딧 차감
     * @param agent 에이전트 주소
     * @param amount 차감할 크레딧
     * @param conceptId 구매한 개념 ID (예: "rag")
     * @param actionType "purchase" 또는 "follow"
     */
    function consumeCredit(
        address agent,
        uint256 amount,
        string calldata conceptId,
        string calldata actionType
    ) external onlyAuthorized {
        require(credits[agent] >= amount, "Insufficient credits");

        credits[agent] -= amount;

        emit CreditConsumed(
            agent,
            amount,
            conceptId,
            actionType,
            credits[agent]
        );
    }

    /**
     * @notice 큐레이터 보상 분배 (구매 수익의 40%)
     * @param curator 큐레이터 주소
     * @param amount 보상 크레딧
     * @param conceptId 보상 발생 개념 ID
     */
    function distributeReward(
        address curator,
        uint256 amount,
        string calldata conceptId
    ) external onlyAuthorized {
        require(curator != address(0), "Invalid curator address");
        require(amount > 0, "Amount must be > 0");

        rewards[curator] += amount;

        emit RewardDistributed(curator, amount, conceptId);
    }

    /**
     * @notice 지식 구매 프로비넌스(영수증) 온체인 기록
     * @dev 한 번 기록된 해시는 재기록 불가 (불변성 보장)
     * @param hash 프로비넌스 해시 (query response의 SHA256)
     * @param agent 구매한 에이전트 주소
     * @param conceptId 구매한 개념 ID
     */
    function recordProvenance(
        bytes32 hash,
        address agent,
        string calldata conceptId
    ) external onlyAuthorized {
        require(!provenanceExists[hash], "Provenance already recorded");

        provenanceExists[hash] = true;

        emit ProvenanceRecorded(hash, agent, conceptId, block.timestamp);
    }

    // ═══════════════════════════════════════════
    // View functions
    // ═══════════════════════════════════════════

    function getCredits(address agent) external view returns (uint256) {
        return credits[agent];
    }

    function getRewards(address curator) external view returns (uint256) {
        return rewards[curator];
    }

    function verifyProvenance(bytes32 hash) external view returns (bool) {
        return provenanceExists[hash];
    }

    // ═══════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════

    function setAuthorizedServer(address _server) external onlyOwner {
        authorizedServer = _server;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
