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

 

  return {
    dir: {
      input: "src",
      data: "_data",
      includes: "_includes",
      layouts: "_layouts",
    },
  };
};