const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

fs.mkdirSync("dist", { recursive: true });
fs.copyFileSync("index.html", path.join("dist", "index.html"));
if (fs.existsSync("settings.html")) {
    fs.copyFileSync("settings.html", path.join("dist", "settings.html"));
}
copyDir("js", path.join("dist", "js"));
console.log("dist/ 복사 완료");
