const Image = require("@11ty/eleventy-img");
const { DateTime } = require("luxon");
const pageHeading = require("./src/_includes/shortcodes/pageHeading.js");
const querystring = require("querystring");
//pass-through
module.exports = function(eleventyConfig) {

  // STYLE AND STATIC FILES
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("src/assets/css/tailwind.css");
  eleventyConfig.addPassthroughCopy("src/assets/icons");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");

  // IMAGES
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/blog/_img");

  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "/robots.txt" });

  // SHORTCODES
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);
  eleventyConfig.addShortcode("pageHeading", pageHeading);

  // SORTING
  eleventyConfig.addShortcode("currentDate", (date = DateTime.now()) => {
    return date;
  });

  eleventyConfig.addFilter("urlencode", function(str) {
    return encodeURIComponent(str)
  });
  
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
      return b.date - a.date;
    });
  });

  eleventyConfig.addCollection("mocPosts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("./src/blog/*.md")
      .filter(post => post.data.topics && post.data.topics.includes("MOC"));
  });

  // ALL UNIQUE TOPICS
  eleventyConfig.addCollection("topicsList", (collection) => {
    const topics = new Set();
    collection.getAll().forEach(item => {
      if (item.data.topics) item.data.topics.forEach(t => topics.add(t));
    });
    return [...topics];
  });

  // POSTS GROUPED BY TOPIC
  eleventyConfig.addCollection("postsByTopic", (collection) => {
    const posts = collection.getFilteredByTag("post");
    const map = {};

    posts.forEach(post => {
      const topics = post.data.topics || [];
      topics.forEach(topic => {
        if (!map[topic]) map[topic] = [];
        map[topic].push(post);
      });
    });

    Object.keys(map).forEach(topic => {
      map[topic].sort((a, b) => b.date - a.date);
    });

    return map;
  });

  // TOPIC PAGE PAGINATION
  eleventyConfig.addCollection("topicPages", function(collectionApi) {
    const posts = collectionApi.getFilteredByTag("post");
    const topicsMap = {};
    const pageSize = 5;

    posts.forEach(post => {
      const topics = post.data.topics || [];
      topics.forEach(topic => {
        if (!topicsMap[topic]) topicsMap[topic] = [];
        topicsMap[topic].push(post);
      });
    });

    const topicPages = [];

    Object.entries(topicsMap).forEach(([topic, postsForTopic]) => {
      postsForTopic.sort((a, b) => b.date - a.date);
      const pageCount = Math.ceil(postsForTopic.length / pageSize);

      for (let i = 0; i < pageCount; i++) {
        topicPages.push({
          currentTopic: topic,
          topic,
          posts: postsForTopic.slice(i * pageSize, (i + 1) * pageSize),
          pageNumber: i,
          totalPages: pageCount,
          permalink: `/blog/topic/${topic}/page/${i + 1}/`
        });
      }
    });

    return topicPages;
  });


  // -------------------------------------------------------------
  // FIX IMAGE PATHS TRANSFORM – START
  // Исправляет пути вида "assets/images/x.png" → "/assets/images/x.png"
  // Работает только в итоговом HTML, не ломает Markdown, не ломает шорткод.
  // -------------------------------------------------------------

  eleventyConfig.addTransform("fixImagePathsForSite", function(content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;

    let fixed = content;

    const clean = s => s.replace(/^[.\/]+/, "");

    // Fix <img src="">
    fixed = fixed.replace(/<img([^>]*?)src=["'](?!\/|https?:\/\/)([^"']+)["']([^>]*?)>/gi,
      (m, b, src, a) => `<img${b}src="/${clean(src)}"${a}>`
    );

    // Fix <source srcset="">
    fixed = fixed.replace(/<source([^>]*?)srcset=["']([^"']+)["']([^>]*?)>/gi,
      (m, b, set, a) => {
        const items = set.split(",").map(p => {
          let parts = p.trim().split(" ");
          let url = parts[0];
          if (!url.startsWith("/") && !/^https?:\/\//.test(url)) {
            url = "/" + clean(url);
          }
          parts[0] = url;
          return parts.join(" ");
        });
        return `<source${b}srcset="${items.join(", ")}"${a}>`;
      }
    );

    return fixed;
  });

  // FIX IMAGE PATHS TRANSFORM – END
  // -------------------------------------------------------------


  return {
    dir: {
      input: "src",
      data: "_data",
      includes: "_includes",
      layouts: "_layouts",
    },
  };
};


// -------------------------------------------------------------
// IMAGE SHORTCODE — оставлен нетронутым
// -------------------------------------------------------------
async function imageShortcode(src, alt, widths = [800, 1200], formats = ["webp", "jpeg"]) {
  let fullSrc = `./src${src}`;
  let metadata = await Image(fullSrc, {
    widths,
    formats,
    urlPath: "/images/",
    outputDir: "./_site/images/"
  });

  let lowRes = metadata.jpeg[0];
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
}
