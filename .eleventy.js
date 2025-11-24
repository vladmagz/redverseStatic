const Image = require("@11ty/eleventy-img");
const { DateTime } = require("luxon");
const pageHeading = require("./src/_includes/shortcodes/pageHeading.js");
const { JSDOM } = require("jsdom");

//pass-through
module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("src/assets/css/tailwind.css");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/icons");
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "/robots.txt" });
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);

//shortcodes - basically, a function
eleventyConfig.addShortcode("pageHeading", pageHeading);

//sorting
eleventyConfig.addShortcode("currentDate", (date = DateTime.now()) => {
	return date;
})

eleventyConfig.addFilter("postDate", (dateObj) => {
	return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
});
  
eleventyConfig.addCollection("page", function(collections) {
    return collections.getFilteredByTag("page").sort(function(a, b) {
      return a.data.order - b.data.order;
    });
  });
  
  
eleventyConfig.addCollection("post", function (collectionApi) {
  return collectionApi.getFilteredByTag("post").sort((a, b) => {
    return b.date - a.date; // новые сверху
  });
});


eleventyConfig.addCollection("topicsList", function(collection) {
  let topics = new Set()

  collection.getAll().forEach(item => {
    if (item.data.topics) {
      item.data.topics.forEach(t => topics.add(t))
    }
  })

  return [...topics]
});

eleventyConfig.addCollection("postsByTopic", function(collection) {
  const posts = collection.getFilteredByTag("post")

  let map = {}

  posts.forEach(post => {
    let topics = post.data.topics || []

    topics.forEach(topic => {
      if (!map[topic]) map[topic] = []
      map[topic].push(post)
    })
  })

  return map
});

eleventyConfig.addNunjucksFilter("range", function(n) {
  return [...Array(n).keys()];
}); 

  return {
    dir: {
      input: "src",
      data: "_data",
      includes: "_includes",
      layouts: "_layouts",
    },
  };
};


async function imageShortcode(src, alt, widths = [800, 1200], formats = ["webp", "jpeg"]) {
  let fullSrc = `./src${src}`; // путь из фронтматтера
  let metadata = await Image(fullSrc, {
    widths,
    formats,
    urlPath: "/images/",
    outputDir: "./_site/images/"
  });

  let lowRes = metadata.jpeg[0]; // самая маленькая jpeg-версия
  let highRes = metadata.jpeg[metadata.jpeg.length - 1];

  // определяем aspect ratio для контейнера
  const aspectRatio = (lowRes.width / lowRes.height).toFixed(4);

  return `
    <div class="blog-thumb" style="aspect-ratio: ${aspectRatio}; overflow: hidden; border-radius: 5px;">
      <picture>
        ${Object.values(metadata)
          .map(formatArr => 
            formatArr.map(img => 
              `<source type="image/${img.format}" srcset="${img.srcset}" sizes="(max-width: 1200px) 100vw, 1200px">`
            ).join("")
          ).join("")}
        <img src="${lowRes.url}" alt="${alt}" loading="lazy" decoding="async"
             width="${lowRes.width}" height="${lowRes.height}"
             style="width: 100%; height: 100%; object-fit: cover;">
      </picture>
    </div>
  `;
};
