const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = 3000;

// folder lưu file
const STORAGE_ROOT = path.join(__dirname, "storage");

// tạo folder nếu chưa có
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// DB fake
const db = {
  files: []
};

// helper tạo folder theo ngày + mã phiếu
function buildFolder(maPhieuKham, ngayLuuTru) {
  const d = new Date(ngayLuuTru);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return path.join("Kho BH", yyyy.toString(), mm, dd, maPhieuKham);
}

// =======================
// HEALTH
// =======================
app.get("/health", (req, res) => {
  res.json({ success: true, message: "OK" });
});

// =======================
// IMPORT FILE (HIS -> CLOUD)
// =======================
app.post("/api/v1/his/import-file", (req, res) => {
  try {
    const {
      maPhieuKham,
      maBenhAn,
      ngayLuuTru,
      trangThaiKySo,
      daTaoPdf,
      files
    } = req.body;

    // validate
    if (!maPhieuKham) {
      return res.status(400).json({ message: "Thiếu maPhieuKham" });
    }

    if (trangThaiKySo !== "SIGNED") {
      return res.status(400).json({ message: "Chưa ký số" });
    }

    if (!daTaoPdf) {
      return res.status(400).json({ message: "Chưa tạo PDF" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "Không có file" });
    }

    const folderPath = buildFolder(maPhieuKham, ngayLuuTru);
    const fullPath = path.join(STORAGE_ROOT, folderPath);

    // tạo folder
    fs.mkdirSync(fullPath, { recursive: true });

    let savedFiles = [];

    files.forEach((file) => {
      if (!file.tenFile.endsWith(".pdf")) return;

      const buffer = Buffer.from(file.contentBase64, "base64");
      const filePath = path.join(fullPath, file.tenFile);

      fs.writeFileSync(filePath, buffer);

      const fileRecord = {
        id: Date.now().toString(),
        tenFile: file.tenFile,
        path: folderPath,
        fullPath: filePath
      };

      db.files.push(fileRecord);
      savedFiles.push(fileRecord);
    });

    return res.json({
      success: true,
      folder: folderPath,
      files: savedFiles
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// =======================
// GET FOLDER DETAIL
// =======================
app.get("/api/v1/kho/folder-detail", (req, res) => {
  const folderPath = req.query.path;

  const files = db.files
    .filter((f) => f.path === folderPath)
    .map((f) => ({
      id: f.id,
      tenFile: f.tenFile,
      previewUrl: `/api/v1/files/${f.id}/preview`,
      downloadUrl: `/api/v1/files/${f.id}/download`
    }));

  return res.json({
    path: folderPath,
    files
  });
});

// =======================
// PREVIEW FILE
// =======================
app.get("/api/v1/files/:id/preview", (req, res) => {
  const file = db.files.find((f) => f.id === req.params.id);

  if (!file) return res.status(404).send("Not found");

  res.setHeader("Content-Type", "application/pdf");
  fs.createReadStream(file.fullPath).pipe(res);
});

// =======================
// DOWNLOAD FILE
// =======================
app.get("/api/v1/files/:id/download", (req, res) => {
  const file = db.files.find((f) => f.id === req.params.id);

  if (!file) return res.status(404).send("Not found");

  res.download(file.fullPath);
});

// =======================
app.listen(PORT, () => {
  console.log("Server chạy tại http://localhost:" + PORT);
});