let searchIndex = [];
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

// Load search index
async function loadSearchIndex() {
  try {
    const response = await fetch("/search-index.json");
    searchIndex = await response.json();
    console.log(`Loaded ${searchIndex.length} posts into search index`);
  } catch (error) {
    console.error("Error loading search index:", error);
  }
}

// Initialize search
async function initSearch() {
  await loadSearchIndex();
  if (!searchInput || !searchResults) return;

  searchInput.addEventListener("input", debounce(handleSearch, 300));
  searchInput.addEventListener("focus", () => {
    searchResults.style.display = "block";
  });

  // Close search results when clicking outside
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = "none";
    }
  });
}

// Handle search
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();

  if (!query) {
    searchResults.style.display = "none";
    return;
  }

  const results = searchIndex.filter((post) => {
    const titleMatch = post.title.toLowerCase().includes(query);
    const contentMatch = post.content.toLowerCase().includes(query);
    const tagsMatch = post.tags.some((tag) =>
      tag.toLowerCase().includes(query)
    );
    return titleMatch || contentMatch || tagsMatch;
  });

  displayResults(results, query);
}

// Display search results
function displayResults(results, query) {
  if (!results.length) {
    searchResults.innerHTML = '<div class="no-results">No posts found</div>';
    searchResults.style.display = "block";
    return;
  }

  const html = results
    .map(
      (post) => `
    <div class="search-result">
      <h3><a href="${post.url}">${highlightText(post.title, query)}</a></h3>
      <div class="meta">
        <span>📅 ${formatDate(post.date)}</span>
        <span>⏱️ ${post.readingTime} min read</span>
      </div>
      <p>${highlightText(post.excerpt, query)}</p>
      <div class="tags">
        ${post.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
    </div>
  `
    )
    .join("");

  searchResults.innerHTML = html;
  searchResults.style.display = "block";
}

// Highlight search query in text
function highlightText(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

// Format date helper
function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize search when DOM is loaded
document.addEventListener("DOMContentLoaded", initSearch);
