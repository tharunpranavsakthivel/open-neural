/**
 * Electron Builder configuration for OpenNeural.
 *
 * Defines build targets for macOS (.dmg), Windows (.exe), and Linux (.AppImage).
 * The configuration is used by electron-builder to package the application.
 *
 * @see https://www.electron.build/configuration/configuration
 */

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "ai.openneural.app",
  productName: "OpenNeural",
  copyright: "Copyright © 2024 OpenNeural",
  
  // Directories
  directories: {
    output: "dist",
    buildResources: "build"
  },

  // Files to include in the app
  files: [
    "dist/**/*",
    "renderer/**/*",
    "!**/*.ts",
    "!**/*.map",
    "!**/test/**/*",
    "!**/tests/**/*",
    "!**/*.test.*",
    "!**/*.spec.*"
  ],

  // Extra resources (Python backend, etc.)
  extraResources: [
    {
      from: "../backend",
      to: "backend",
      filter: [
        "**/*",
        "!**/__pycache__/**/*",
        "!**/*.pyc",
        "!**/*.pyo",
        "!**/test/**/*",
        "!**/tests/**/*",
        "!**/.pytest_cache/**/*",
        "!**/*.egg-info/**/*",
        "!**/build/**/*",
        "!**/dist/**/*",
        "!**/.venv/**/*",
        "!**/requirements*.txt",
        "!**/pyproject.toml"
      ]
    }
  ],

  // macOS configuration
  mac: {
    category: "public.app-category.developer-tools",
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"]
      },
      {
        target: "zip",
        arch: ["x64", "arm64"]
      }
    ],
    icon: "build/icon.icns",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    notarize: false // Set to true and configure for production signing
  },

  // DMG configuration
  dmg: {
    sign: false,
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: "link",
        path: "/Applications"
      }
    ],
    window: {
      width: 540,
      height: 380
    }
  },

  // Windows configuration
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      },
      {
        target: "portable",
        arch: ["x64"]
      }
    ],
    icon: "build/icon.ico",
    publisherName: "OpenNeural",
    verifyUpdateCodeSignature: false
  },

  // NSIS installer configuration
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: "build/icon.ico",
    uninstallerIcon: "build/icon.ico",
    installerSidebar: "build/installerSidebar.bmp",
    uninstallerSidebar: "build/uninstallerSidebar.bmp",
    license: "../LICENSE",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "OpenNeural",
    include: "build/installer.nsh",
    deleteAppDataOnUninstall: true
  },

  // Linux configuration
  linux: {
    target: [
      {
        target: "AppImage",
        arch: ["x64"]
      },
      {
        target: "deb",
        arch: ["x64"]
      }
    ],
    category: "Development",
    icon: "build/icons",
    maintainer: "OpenNeural Team",
    vendor: "OpenNeural",
    synopsis: "Local-first ML experimentation application",
    description: "OpenNeural is a local-first desktop application for machine learning experimentation, enabling researchers to train, evaluate, and export ML models entirely on their own machine.",
    desktop: {
      Name: "OpenNeural",
      Comment: "Local ML experimentation",
      Categories: "Development;Science;DataAnalysis;"
    }
  },

  // AppImage configuration
  appImage: {
    artifactName: "${name}-${version}-${arch}.${ext}",
    category: "Development"
  },

  // Deb configuration
  deb: {
    priority: "optional",
    depends: [
      "python3.11 | python3.12",
      "python3-pip"
    ]
  },

  // ASAR configuration
  asar: true,
  asarUnpack: [
    "**/*.node",
    "**/backend/**/*"
  ],

  // Compression
  compression: "maximum",
  
  // Remove empty directories
  removePackageScripts: true,

  // Publish configuration (for auto-updater)
  publish: {
    provider: "github",
    owner: "openneural",
    repo: "openneural",
    releaseType: "draft"
  }
};
