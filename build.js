require("dotenv").config();
const nunjucks = require("nunjucks");
nunjucks.configure("views", { autoescape: false });
const fs = require("fs");
const fsExtra = require("fs-extra");
const sharp = require("sharp");
const path = require("path");
const {
  postcssRun,
  parseMarkdownDirectory,
  saveToFile,
  deleteDirectoryRecursive,
  shuffle,
} = require("./utils/helpers.js");

const BUILD_DIRECTORY = "_site";
const STATIC_DIRECTORY = "static";

/**
 * Variables par défaut pour les templates nunjucks. A passer manuellement
 * en appelant la fonction "render". Permet de passer les variables d'env.
 */
const defaultContext = {
  SITE_BASE_URL: process.env.SITE_BASE_URL,
};

/**
 * BUILD STATIC SITE
 */
build();

function build() {
  // delete and recreate BUILD directory
  deleteDirectoryRecursive(`./${BUILD_DIRECTORY}`);
  fs.mkdirSync(`./${BUILD_DIRECTORY}`);

  // copy files from static diretory to build directory
  fsExtra.copySync(
    path.resolve(`./${STATIC_DIRECTORY}`),
    path.resolve(`./${BUILD_DIRECTORY}`),
    {
      recursive: true,
    }
  );

  // create html files from markdown files
  buildPages();
  buildPersons();

  // compiled and purge tailwind.css
  const purgecssConfig = {
    content: ["views/**/*.njk"],
    defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
  };
  postcssRun("./static/app.css", "./_site/app.css", purgecssConfig);

  // resize and compress jpeg for homepage listing.
  fs.mkdirSync("./_site/thumbnails");
  fs.mkdirSync("./_site/thumbnails/homepage");
  const promises = [];
  fs.readdirSync("./_site/photos").forEach(function (filename) {
    sharp("./_site/photos/" + filename)
      .png({ compression: 9 })
      .jpeg({ progressive: true, quality: 90 })
      .resize(300)
      .toFile("./_site/thumbnails/homepage/" + filename);
  });
}

function buildPages() {
  let entities = parseMarkdownDirectory("./content/pages");
  entities.forEach((entity) => {
    const html = nunjucks.render("page.njk", { entity, ...defaultContext });
    saveToFile(`./${BUILD_DIRECTORY}/pages/${entity.$slug}/index.html`, html);
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

  // photo
  resources = resources.map((resource) => {
    const { gravatar, mail, photo } = resource;
    // no gravatar information -> quit
    if (!gravatar)
      return {
        ...resource,
        filename: photo,
        photo: `/photos/${photo}`,
        thumbnail_homepage: `/thumbnails/homepage/${photo}`,
      };

    // gravatar field can be a boolean, in which case we use the mail field
    // or it can be a string, in which case we use its value
    const gravatarEmail = typeof gravatar === "boolean" ? mail : gravatar;

    // we needs to retrieve the md5 of the email to get the avatar from gravatar
    const md5sum = md5(gravatarEmail.toLowerCase().trim());

    return {
      ...resource,
      photo: `https://www.gravatar.com/avatar/${md5sum}?s=500`,
      thumbnail_homepage: `https://www.gravatar.com/avatar/${md5sum}?s=500`,
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

  const html = nunjucks.render("index.njk", {
    persons: shuffle(resources),
    ...defaultContext,
  });
  saveToFile(`./${BUILD_DIRECTORY}/index.html`, html);
  resources.forEach((person) => {
    const personHtml = nunjucks.render("person.njk", {
      entity: person,
      ...defaultContext,
    });
    saveToFile(
      `./${BUILD_DIRECTORY}/person/${person.$slug}/index.html`,
      personHtml
    );
  });
}
