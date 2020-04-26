const fs = require("fs");
const yamlFront = require("yaml-front-matter");
const path = require("path");
const slug = require("slug");
const fsExtra = require("fs-extra");
const markdownItInstance = require("markdown-it")({
  html: true,
  linkify: true,
});
const nunjucks = require("nunjucks");
nunjucks.configure("theme/views", { autoescape: false });

const siteDirectory = "_site";

compileSite();

/*===================================
 * Popcorn.js static site generator
 *==================================*/

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

function saveToDirectory(filepath, data) {
  const directoriesPath = path.dirname(filepath);
  if (!fs.existsSync(directoriesPath)) {
    fs.mkdirSync(directoriesPath, { recursive: true });
  }
  fs.writeFileSync(filepath, data);
  console.log("\x1b[32m", `📚 ${filepath} created.`);
}

function removeAllFilesFromDirectory(directory) {
  fs.readdirSync(directory, (err, files) => {
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

function compileSite() {
  fsExtra.copySync("./public", "_site/public", { recursive: true });
  compilePages();
  compilePersons();
}

function compilePages() {
  let entities = parseMarkdownDirectory("./content/pages");
  entities.forEach((entity) => {
    const html = nunjucks.render("page.njk", { entity });
    saveToDirectory(`./${siteDirectory}/pages/${entity.$slug}.html`, html);
  });
}

function compilePersons() {
  let resources = parseMarkdownDirectory("./content/persons");
  // keywords
  resources = resources.map((resource) => ({
    ...resource,
    $search_keywords: [
      ...resource.domaines_metiers,
      ...resource.technologies,
      resource.titre,
    ],
  }));

  // gravatar
  resources = resources.map((resource) => {
    const { gravatar, mail, photo } = resource;
    // no gravatar information -> quit
    if (!gravatar) return { ...resource, photo: `/public${photo}` };

    // gravatar field can be a boolean, in which case we use the mail field
    // or it can be a string, in which case we use its value
    const gravatarEmail = typeof gravatar === "boolean" ? mail : gravatar;

    // we needs to retrieve the md5 of the email to get the avatar from gravatar
    const md5sum = md5(gravatarEmail.toLowerCase().trim());

    return {
      ...resource,
      photo: `https://www.gravatar.com/avatar/${md5sum}?s=500`,
    };
  });

  saveToDirectory(
    `./${siteDirectory}/api/persons.json`,
    JSON.stringify(shuffle(resources))
  );

  const html = nunjucks.render("index.njk", { persons: resources });
  saveToDirectory(`./${siteDirectory}/index.html`, html);
}
