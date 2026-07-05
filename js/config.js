const STORAGE_KEY = "node_system_unified_v1";
const STORAGE_VERSION = 3;
const APP_BUILD = 24;
const MAX_UNDO = 30;
const ONBOARDING_KEY = "nucleus_onboarding_done";
const MAPS_INDEX_KEY = "nucleus_maps_index";
const APP_META_KEY = "nucleus_app_meta";
const SYNC_CONFIG_KEY = "nucleus_sync_config";

let _nodeIdSeq = 0;
function generateNodeId() {
  _nodeIdSeq += 1;
  return Date.now() * 1000 + (_nodeIdSeq % 1000);
}

function mapStorageKey(mapId) {
  return "nucleus_map_" + mapId;
}
