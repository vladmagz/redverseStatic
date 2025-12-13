const Image = require("@11ty/eleventy-img");
const { DateTime } = require("luxon");
const pageHeading = require("./src/_includes/shortcodes/pageHeading.js");
const querystring = require("querystring");
const path = require("path");

module.exports = function(eleventyConfig) {

  // -------------------------------------------------------------
  // STATIC FILES
  // -------------------------------------------------------------
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("src/assets/css/tailwind.css");
  eleventyConfig.addPassthroughCopy("src/assets/icons");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/blog/_img");
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "/robots.txt" });


  // -------------------------------------------------------------
  // SHORTCODES
  // -------------------------------------------------------------
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);
  eleventyConfig.addShortcode("pageHeading", pageHeading);

  // -------------------------------------------------------------
  // FILTERS
  // -------------------------------------------------------------
  eleventyConfig.addShortcode("currentDate", () => DateTime.now());
  
  eleventyConfig.addFilter("urlencode", str => encodeURIComponent(str));

  eleventyConfig.addFilter("postDate", dateObj =>
    DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED)
  );

  eleventyConfig.addFilter("rssDate", dateObj =>
    DateTime.fromJSDate(dateObj).toRFC2822()
  );

  eleventyConfig.addFilter("xmlEscape", str => {
    if(!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  });


  // -------------------------------------------------------------
  // COLLECTIONS
  // -------------------------------------------------------------
  eleventyConfig.addCollection("page", collections =>
    collections.getFilteredByTag("page").sort((a, b) => a.data.order - b.data.order)
  );

  eleventyConfig.addCollection("post", api =>
    api.getFilteredByTag("post").sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("mocPosts", api =>
    api.getFilteredByTag("post")
      .filter(p => p.data.topics && p.data.topics.includes("MOC"))
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("topicsList", collection => {
    const topics = new Set();
    collection.getAll().forEach(item => {
      if (item.data.topics) item.data.topics.forEach(t => topics.add(t));
    });
    return [...topics];
  });

  eleventyConfig.addCollection("postsByTopic", collection => {
    const map = {};
    const posts = collection.getFilteredByTag("post");

    posts.forEach(post => {
      (post.data.topics || []).forEach(topic => {
        if (!map[topic]) map[topic] = [];
        map[topic].push(post);
      });
    });

    Object.keys(map).forEach(topic => {
      map[topic].sort((a, b) => b.date - a.date);
    });

    return map;
  });

  eleventyConfig.addCollection("topicPages", api => {
    const posts = api.getFilteredByTag("post");
    const map = {};
    const pageSize = 5;

    posts.forEach(post => {
      (post.data.topics || []).forEach(topic => {
        if (!map[topic]) map[topic] = [];
        map[topic].push(post);
      });
    });

    const pages = [];

    Object.entries(map).forEach(([topic, items]) => {
      items.sort((a, b) => b.date - a.date);
      const pageCount = Math.ceil(items.length / pageSize);

      for (let i = 0; i < pageCount; i++) {
        pages.push({
          topic,
          currentTopic: topic,
          posts: items.slice(i * pageSize, (i + 1) * pageSize),
          pageNumber: i,
          totalPages: pageCount,
          permalink: `/blog/topic/${topic}/page/${i + 1}/`
        });
      }
    });

    return pages;
  });


  // -------------------------------------------------------------
  // FIX IMAGE PATHS (чтобы Markdown не ломал пути)
  // -------------------------------------------------------------
  eleventyConfig.addTransform("fixImagePathsForSite", function(content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;

    let fixed = content;
    const clean = s => s.replace(/^[.\/]+/, "");

    fixed = fixed.replace(
      /<img([^>]*?)src=["'](?!\/|https?:\/\/)([^"']+)["']([^>]*?)>/gi,
      (m, b, src, a) => `<img${b}src="/${clean(src)}"${a}>`
    );

    fixed = fixed.replace(
      /<source([^>]*?)srcset=["']([^"']+)["']([^>]*?)>/gi,
      (m, b, set, a) => {
        const items = set.split(",").map(item => {
          let parts = item.trim().split(" ");
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


  // -------------------------------------------------------------
  // AUTO WEBP GENERATION FOR ALL PNG IN HTML
  // -------------------------------------------------------------
  eleventyConfig.addTransform("autoWebpForMarkdownPng", async function(content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;

    const regex = /<img[^>]+src=["']([^"']+\.png)["'][^>]*>/gi;
    const tasks = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const pngUrl = match[1];
      const input = path.join("src", pngUrl);
      const outputDir = path.join("_site", path.dirname(pngUrl));
      const urlPath = path.dirname(pngUrl);

      tasks.push(
        Image(input, {
          widths: [800, 1200],
          formats: ["webp"],
          outputDir,
          urlPath,
        })
      );
    }

    if (tasks.length) await Promise.all(tasks);
    return content;
  });


  // -------------------------------------------------------------
  // FORMATS
  // -------------------------------------------------------------
  eleventyConfig.setTemplateFormats([
    "html",
    "md",
    "njk",
    "xml"
  ]);


  // -------------------------------------------------------------
  // DIRECTORIES
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
// IMAGE COMPRESS SHORTCODE
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
    <div class="blog-thumb" style="aspect-ratio:${aspectRatio};overflow:hidden;border-radius:5px;">
      <picture>
        ${Object.values(metadata)
          .map(arr =>
            arr
              .map(img => `<source type="image/${img.format}" srcset="${img.srcset}" sizes="(max-width:1200px) 100vw, 1200px">`)
              .join("")
          )
          .join("")}
        <img src="${lowRes.url}" alt="${alt}" loading="lazy" decoding="async"
             width="${lowRes.width}" height="${lowRes.height}"
             style="width:100%;height:100%;object-fit:cover;">
      </picture>
    </div>
  `;
}
