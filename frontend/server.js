import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Static assets
app.use("/pages", express.static(path.join(__dirname, "pages")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/dist", express.static(path.join(__dirname, "dist")));

// Runtime config injection for the static pages.
// Set API_BASE in Elastic Beanstalk environment properties to your backend base URL,
// e.g. https://your-backend-env.us-east-1.elasticbeanstalk.com
app.get("/config.js", (req, res) => {
  const apiBase = process.env.API_BASE || "";
  res.type("application/javascript");
  res.send(`window.__API_BASE__ = ${JSON.stringify(apiBase)};`);
});

app.get("/", (req, res) => res.redirect("/pages/index.html"));

app.listen(port, () => {
  console.log(`Frontend server listening on port ${port}`);
});
