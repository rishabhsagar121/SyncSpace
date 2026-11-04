export const SOCKET_EVENTS = {
  // Connection / presence
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
  PRESENCE_UPDATE: 'presence:update',

  // Rooms
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_MEMBER_JOINED: 'room:member-joined',
  ROOM_MEMBER_LEFT: 'room:member-left',
  ROOM_MEMBER_KICKED: 'room:member-kicked',
  ROOM_MEMBER_MUTED: 'room:member-muted',
  ROOM_HOST_TRANSFERRED: 'room:host-transferred',
  ROOM_DELETED: 'room:deleted',
  ROOM_ERROR: 'room:error',

  // Chat
  CHAT_MESSAGE_NEW: 'chat:message-new',
  CHAT_MESSAGE_EDITED: 'chat:message-edited',
  CHAT_MESSAGE_DELETED: 'chat:message-deleted',
  CHAT_REACTION_ADDED: 'chat:reaction-added',
  CHAT_REACTION_REMOVED: 'chat:reaction-removed',
  CHAT_TYPING_START: 'chat:typing-start',
  CHAT_TYPING_STOP: 'chat:typing-stop',

  // Watch/listen sync (playback)
  SYNC_PLAY: 'sync:play',
  SYNC_PAUSE: 'sync:pause',
  SYNC_SEEK: 'sync:seek',
  SYNC_STATE_REQUEST: 'sync:state-request',
  SYNC_STATE_UPDATE: 'sync:state-update',
  SYNC_QUEUE_UPDATE: 'sync:queue-update',
  SYNC_SOURCE_CHANGE: 'sync:source-change',

  // WebRTC signaling
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',
  WEBRTC_JOIN_CALL: 'webrtc:join-call',
  WEBRTC_LEAVE_CALL: 'webrtc:leave-call',
  WEBRTC_PEER_JOINED: 'webrtc:peer-joined',
  WEBRTC_PEER_LEFT: 'webrtc:peer-left',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',
};