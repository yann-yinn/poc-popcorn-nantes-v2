const nunjucks = require("nunjucks");
nunjucks.configure("theme/views", { autoescape: false });
const fs = require("fs");
const sharp = require("sharp");

const {
  parseMarkdownDirectory,
  saveToFile,
  copyStaticFiles,
  deleteBuildDirectory,
  BUILD_DIRECTORY,
  shuffle,
} = require("./utils/generator.js");

build();

function build() {
  deleteBuildDirectory();
  copyStaticFiles();
  // copy JS files
  fs.copyFile("./theme/app.js", `./${BUILD_DIRECTORY}/app.js`, (err) => {
    if (err) throw err;
  });
  fs.copyFile("./theme/search.js", `./${BUILD_DIRECTORY}/search.js`, (err) => {
    if (err) throw err;
  });
  buildPages();
  buildPersons();

  fs.mkdirSync("./_site/thumbnails");

  fs.readdirSync("./_site/photos").forEach(function (filename) {
    sharp("./_site/photos/" + filename)
      .resize(300)
      .jpeg({ progressive: true, force: false, quality: 90 })
      .png({ progressive: true, force: false, compressionLevel: 9 })
      .toFile("./_site/thumbnails/" + filename)
      .then((v) => {});
  });
}

function buildPages() {
  let entities = parseMarkdownDirectory("./content/pages");
  entities.forEach((entity) => {
    const html = nunjucks.render("page.njk", { entity });
    saveToFile(`./${BUILD_DIRECTORY}/pages/${entity.$slug}.html`, html);
  });
}

function buildPersons() {
  let resources = parseMarkdownDirectory("./content/persons");
  // keywords
  resources = resources.map((resource) => ({
    ...resource,
    // this is how we will build search index for our search engine.
    $search_keywords: [
      ...resource.domaines_metiers,
      ...resource.technologies,
      resource.titre,
    ],
    mail: Buffer.from(resource.mail).toString("base64"),
    telephone: resource.telephone
      ? new Buffer(resource.telephone).toString("base64")
      : "",
  }));

  // gravatar
  resources = resources.map((resource) => {
    const { gravatar, mail, photo } = resource;
    // no gravatar information -> quit
    if (!gravatar)
      return {
        ...resource,
        photo: `/photos/${photo}`,
        thumbnail: `/thumbnails/${photo}`,
      };

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

  const searchIndexJson = [];
  resources.map((resource) => {
    searchIndexJson.push({
      id: resource.$slug,
      keywords: resource.$search_keywords,
    });
  });

  saveToFile(
    `./${BUILD_DIRECTORY}/api/search-index.json`,
    JSON.stringify(searchIndexJson)
  );

  const html = nunjucks.render("index.njk", { persons: shuffle(resources) });
  saveToFile(`./${BUILD_DIRECTORY}/index.html`, html);
  resources.forEach((person) => {
    const personHtml = nunjucks.render("person.njk", { entity: person });
    saveToFile(`./${BUILD_DIRECTORY}/person/${person.$slug}.html`, personHtml);
  });
}
