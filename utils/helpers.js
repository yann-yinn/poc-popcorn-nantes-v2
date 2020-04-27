const fs = require("fs");
const fsExtra = require("fs-extra");
const yamlFront = require("yaml-front-matter");
const path = require("path");
const slug = require("slug");
const rimraf = require("rimraf");
const autoprefixer = require("autoprefixer");
const postcss = require("postcss");
const purgecss = require("@fullhuman/postcss-purgecss");

const markdownItInstance = require("markdown-it")({
  html: true,
  linkify: true,
});

const BUILD_DIRECTORY = "_site";
const STATIC_DIRECTORY = "static";

module.exports = {
  parseMarkdownDirectory,
  parseMarkdownFile,
  saveToFile,
  removeAllFilesFromDirectory,
  shuffle,
  copyStaticFiles,
  deleteDirectoryRecursive,
  BUILD_DIRECTORY,
  STATIC_DIRECTORY,
  postcssRun,
};

function parseMarkdownDirectory(inputDirectory, options = {}) {
  const directoryPath = inputDirectory;
  const files = fs.readdirSync(directoryPath);
  let resources = files
    .filter((filename) => path.extname(filename) === ".md")
    .filter((filename) => filename.indexOf("_") !== 0)
    .map((filename) => {
      const resource = parseMarkdownFile(
        `${directoryPath}/${filename}`,
        options
      );
      return resource;
    });
  return resources;
}

/**
 * Parse un fichier markdown en un object javascript contenant
 * la front matter et une propriété $html contenant le markdown rendu.
 *
 * @param {*} filepath
 * @param {*} markdownItInstance
 */
function parseMarkdownFile(filepath, options = {}) {
  const fileContent = fs.readFileSync(filepath, "utf8");
  let entity = {};
  try {
    entity = yamlFront.loadFront(fileContent);
  } catch (e) {
    console.log(`${filepath} : compilation of front-matter failed 😱`);
    throw e;
  }
  try {
    entity.$html = markdownItInstance.render(entity.__content);
    delete entity.__content;
  } catch (e) {
    console.log(`${filepath} : rendering of markdown failed 😱`);
    throw e;
  }
  let filename = path.basename(filepath);
  entity.$filename = filename;
  // create a slug from filename
  filename = filename.substring(0, filename.length - 3);
  entity.$slug = slug(filename);
  return entity;
}

function saveToFile(filepath, data) {
  const directoriesPath = path.dirname(filepath);
  try {
    fs.mkdirSync(directoriesPath, { recursive: true });
  } catch (error) {
    throw new Error(error);
  }
  try {
    fs.writeFileSync(filepath, data);
  } catch (error) {
    throw new Error(error);
  }
  //console.log("\x1b[32m", `📚 ${filepath} created.`);
}

function deleteDirectoryRecursive(directory) {
  const directoryPath = path.resolve(`./${directory}`);
  rimraf.sync(directoryPath);
}

function removeAllFilesFromDirectory(directory) {
  fs.readdirSync(directory, (err, files) => {
    // console.log("files", files);
    if (err) throw err;
    for (const file of files) {
      fs.unlinkSync(path.join(directory, file), (err) => {
        if (err) throw err;
      });
    }
  });
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function copyStaticFiles() {
  const staticDirectory = path.resolve(`./${STATIC_DIRECTORY}`);
  const buildDirecttory = path.resolve(`./${BUILD_DIRECTORY}`);
  if (!fs.existsSync(buildDirecttory)) {
    fs.mkdirSync(buildDirecttory);
  }
  fsExtra.copySync(staticDirectory, buildDirecttory, {
    recursive: true,
  });
}

function postcssRun(source, destination, purgecssConfig) {
  fs.readFile(source, (err, css) => {
    postcss([
      require("tailwindcss"),
      autoprefixer,
      purgecss({
        ...purgecssConfig,
      }),
    ])
      .process(css, { from: source, to: destination })
      .then((result) => {
        console.log("result", result);
        fs.writeFile(destination, result.css, () => true);
        if (result.map) {
          fs.writeFile(`${destination}.map`, result.map, () => true);
        }
      });
  });
}
