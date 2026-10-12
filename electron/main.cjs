
const { app, BrowserWindow, Tray, Menu, nativeImage } = require("electron");
const path = require("node:path");

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Enable startup when the installed app is launched.
app.whenReady().then(() => {
    if (app.isPackaged) {
        app.setLoginItemSettings({
            openAtLogin: true,
        });
    }

    createTray();
    createWindow();

    app.on("activate", () => {
        showNudge();
    });
});

function createWindow() {
    if (mainWindow) {
        showNudge();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        title: "Nudge",
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    const page = app.isPackaged
        ? mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
        : mainWindow.loadURL("http://localhost:5173");

    page.catch((error) => {
        console.error("Nudge failed to load:", error);
    });

    mainWindow.on("close", (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

function showNudge() {
    if (!mainWindow) {
        createWindow();
        return;
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
}

function createTray() {
    // Use a built-in empty image to avoid SVG parsing issues.
    const icon = nativeImage.createEmpty();

    tray = new Tray(icon);
    tray.setToolTip("Nudge - Personal Desktop Wellness Companion");

    const trayMenu = Menu.buildFromTemplate([
        {
            label: "Open Nudge",
            click: showNudge,
        },
        {
            label: "Hide Nudge",
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                }
            },
        },
        { type: "separator" },
        {
            label: "Quit Nudge",
            click: () => {
                isQuitting = true;
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(trayMenu);
    tray.on("click", showNudge);
    tray.on("double-click", showNudge);
}

app.on("window-all-closed", () => {
    // Keep Nudge running in the tray.
});

app.on("before-quit", () => {
    isQuitting = true;
});