import uuid
from typing import List, Dict
from models import Transaction, EchoChain

class EchoTracker:
    def __init__(self):
        self.active_chains: Dict[str, EchoChain] = {}
        self.transactions: List[Transaction] = []
        self.TIME_WINDOW_MS = 120000  # 120 seconds
        self.AMOUNT_VARIANCE = 0.02   # 2% variance
        
        # Device Intelligence correlations
        self.device_to_accounts: Dict[str, set] = {}
        self.ip_to_accounts: Dict[str, set] = {}
        self.device_vpn_status: Dict[str, bool] = {}

    def process_transaction(self, tx: Transaction) -> List[EchoChain]:
        self.transactions.append(tx)
        
        # Track device correlations
        if tx.deviceId not in self.device_to_accounts:
            self.device_to_accounts[tx.deviceId] = set()
        self.device_to_accounts[tx.deviceId].add(tx.senderId)
        self.device_to_accounts[tx.deviceId].add(tx.receiverId)
        
        if tx.ipAddress not in self.ip_to_accounts:
            self.ip_to_accounts[tx.ipAddress] = set()
        self.ip_to_accounts[tx.ipAddress].add(tx.senderId)
        self.ip_to_accounts[tx.ipAddress].add(tx.receiverId)
        
        self.device_vpn_status[tx.deviceId] = getattr(tx, 'vpnUsage', False)

        updated_chains = []

        extended = False
        for chain_id, chain in list(self.active_chains.items()):
            if self.is_echo_transaction(chain, tx):
                self.extend_chain(chain, tx)
                updated_chains.append(chain)
                extended = True

        if not extended:
            recent_txs = self.get_recent_transactions(tx.timestamp - self.TIME_WINDOW_MS)
            for past_tx in recent_txs:
                if past_tx.id != tx.id and self.matches_echo_criteria(past_tx, tx):
                    new_chain = self.create_new_chain(past_tx, tx)
                    self.active_chains[new_chain.chainId] = new_chain
                    updated_chains.append(new_chain)

        self.cleanup_old_chains(tx.timestamp)
        return updated_chains

    def matches_echo_criteria(self, tx1: Transaction, tx2: Transaction) -> bool:
        if tx1.timestamp >= tx2.timestamp:
            return False
        if tx2.timestamp - tx1.timestamp > self.TIME_WINDOW_MS:
            return False
        if tx1.receiverId != tx2.senderId:
            return False

        ratio = tx2.amount / tx1.amount if tx1.amount != 0 else 0
        if ratio < (1 - self.AMOUNT_VARIANCE) or ratio > (1 + self.AMOUNT_VARIANCE):
            return False

        return True

    def is_echo_transaction(self, chain: EchoChain, tx: Transaction) -> bool:
        last_tx = chain.transactions[-1]
        return self.matches_echo_criteria(last_tx, tx)

    def extend_chain(self, chain: EchoChain, tx: Transaction):
        chain.transactions.append(tx)
        chain.lastUpdateTime = tx.timestamp
        chain.depth += 1
        chain.totalAmount += tx.amount
        chain.confidenceScore = self.calculate_confidence(chain)

    def create_new_chain(self, tx1: Transaction, tx2: Transaction) -> EchoChain:
        chain = EchoChain(
            chainId=str(uuid.uuid4()),
            transactions=[tx1, tx2],
            startTime=tx1.timestamp,
            lastUpdateTime=tx2.timestamp,
            depth=2,
            totalAmount=tx1.amount + tx2.amount,
            confidenceScore=0
        )
        chain.confidenceScore = self.calculate_confidence(chain)
        return chain

    def calculate_confidence(self, chain: EchoChain) -> int:
        score = 50
        score += (chain.depth - 2) * 20
        
        avg_time_per_hop = (chain.lastUpdateTime - chain.startTime) / (chain.depth - 1)
        if avg_time_per_hop < 10000:
            score += 15
        elif avg_time_per_hop < 30000:
            score += 5

        # --- Device Intelligence Risk Boosts ---
        devices_in_chain = set()
        ips_in_chain = set()
        for tx in chain.transactions:
            devices_in_chain.add(tx.deviceId)
            ips_in_chain.add(tx.ipAddress)
            
        # 1. Device reuse risk (3+ accounts = highly suspicious)
        max_accounts_per_device = 0
        for device in devices_in_chain:
            linked_accounts = len(self.device_to_accounts.get(device, set()))
            if linked_accounts > max_accounts_per_device:
                max_accounts_per_device = linked_accounts
                
        if max_accounts_per_device >= 3:
            score += 25
        elif max_accounts_per_device == 2:
            score += 10
            
        # 2. IP reuse risk
        max_accounts_per_ip = 0
        for ip in ips_in_chain:
            linked_accounts = len(self.ip_to_accounts.get(ip, set()))
            if linked_accounts > max_accounts_per_ip:
                max_accounts_per_ip = linked_accounts
                
        if max_accounts_per_ip >= 3:
            score += 15
            
        # 3. VPN / Proxy risk boost
        any_vpn = any(self.device_vpn_status.get(d, False) for d in devices_in_chain)
        if any_vpn:
            score += 10

        return min(int(score), 100)

    def get_recent_transactions(self, since: int) -> List[Transaction]:
        recent = []
        for tx in reversed(self.transactions):
            if tx.timestamp < since:
                break
            recent.append(tx)
        return recent

    def cleanup_old_chains(self, current_time: int):
        # We just keep them in memory for the graph but we could expire them here if needed
        pass

    def get_active_chains(self) -> List[EchoChain]:
        return list(self.active_chains.values())
