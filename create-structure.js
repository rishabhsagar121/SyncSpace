const fs = require("fs");
const path = require("path");

const folders = [
  "apps/web/public",
  "apps/web/src/app/providers",
  "apps/web/src/assets",
  "apps/web/src/components",
  "apps/web/src/hooks",
  "apps/web/src/layouts",
  "apps/web/src/lib",
  "apps/web/src/pages",
  "apps/web/src/styles",

  "apps/web/src/features/auth/api",
  "apps/web/src/features/auth/components",
  "apps/web/src/features/auth/hooks",

  "apps/web/src/features/users",
  "apps/web/src/features/friends",
  "apps/web/src/features/rooms",
  "apps/web/src/features/watch-together",
  "apps/web/src/features/listen-together",
  "apps/web/src/features/chat",
  "apps/web/src/features/calls",
  "apps/web/src/features/notifications",
  "apps/web/src/features/settings",

  "apps/server/prisma",

  "apps/server/src/config",
  "apps/server/src/middleware",
  "apps/server/src/services",
  "apps/server/src/sockets/handlers",
  "apps/server/src/sockets/middleware",
  "apps/server/src/utils",

  "apps/server/src/modules/auth",
  "apps/server/src/modules/users",
  "apps/server/src/modules/friends",
  "apps/server/src/modules/rooms",
  "apps/server/src/modules/messages",
  "apps/server/src/modules/notifications",

  "extension/src/background",
  "extension/src/content-scripts/platforms",
  "extension/src/popup",
  "extension/src/lib",

  "packages/shared/constants",
  "packages/shared/types",

  ".github/workflows"
];

folders.forEach(folder => {
  fs.mkdirSync(path.join(__dirname, folder), { recursive: true });
});

console.log("✅ Folder structure created successfully!");
