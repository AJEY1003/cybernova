export interface Transaction {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  timestamp: number;
  deviceId: string;
  ipAddress: string;
  geoRegion: string;
  type: string;
  riskScore: number;
  browserFingerprint?: string;
  userAgent?: string;
  os?: string;
  vpnUsage?: boolean;
}

export interface EchoChain {
  chainId: string;
  transactions: Transaction[];
  startTime: number;
  lastUpdateTime: number;
  confidenceScore: number;
  totalAmount: number;
  depth: number;
}
