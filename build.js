const nunjucks = require("nunjucks");
nunjucks.configure("theme/views", { autoescape: false });
const {
  parseMarkdownDirectory,
  saveToDirectory,
  copyStaticFiles,
  deleteBuildDirectory,
  BUILD_DIRECTORY,
  shuffle,
} = require("./utils/generator.js");

build();

function build() {
  deleteBuildDirectory();
  copyStaticFiles();
  // buildPages();
  // buildPersons();
  /*
  fs.readdirSync("./_site/public/images").forEach(function (filename) {
    console.log("filename", filename);
    sharp("./_site/public/images/" + filename)
      .resize(50)
      .toFile("./_site/public/thumbnails/" + filename);
  });
  */
}

function buildPages() {
  let entities = parseMarkdownDirectory("./content/pages");
  entities.forEach((entity) => {
    const html = nunjucks.render("page.njk", { entity });
    saveToDirectory(`./${BUILD_DIRECTORY}/pages/${entity.$slug}.html`, html);
  });
}

function buildPersons() {
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
    `./${BUILD_DIRECTORY}/api/persons.json`,
    JSON.stringify(shuffle(resources))
  );

  const html = nunjucks.render("index.njk", { persons: resources });
  saveToDirectory(`./${BUILD_DIRECTORY}/index.html`, html);
  resources.forEach((person) => {
    const personHtml = nunjucks.render("person.njk", { entity: person });
    saveToDirectory(
      `./${BUILD_DIRECTORY}/person/${person.$slug}.html`,
      personHtml
    );
  });
}
