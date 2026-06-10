import sys
sys.path.append('d:/Mule/cybernova_old/muleshield_feature04')
from main import selective_block_accounts, SelectiveBlockRequest
import traceback
req = SelectiveBlockRequest(cluster_id='CTRL_CLUSTER_001', accounts_to_block=['ACC_CTRL_001_001'], honey_trap_account='')
try:
    print(selective_block_accounts(req))
except Exception as e:
    print(traceback.format_exc())
