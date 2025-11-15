/**
 *@param {string} title
 *@param {string} subtitle
 *@return {string}
 */

 const pageHeading = (title, subtitle) => {
    return `
      <h1 class="text-5xl font-bold mt-4">${title}</h1>
          <p class="mt-1 text-lg text-gray-600">${subtitle}</p>
      `;
};
  
module.exports = pageHeading;