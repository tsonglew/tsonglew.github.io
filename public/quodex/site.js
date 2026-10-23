const previewButtons = document.querySelectorAll("[data-preview-theme]");
const previewImages = document.querySelectorAll("#screen-previews img[data-light][data-dark]");
const previewControl = document.querySelector(".theme-switch");

if (previewControl && previewImages.length && previewButtons.length) {
  previewControl.hidden = false;
  for (const button of previewButtons) {
    button.addEventListener("click", () => {
      const theme = button.dataset.previewTheme;
      if (theme !== "light" && theme !== "dark") return;
      for (const option of previewButtons) {
        option.setAttribute("aria-pressed", String(option === button));
      }
      for (const image of previewImages) {
        image.src = image.dataset[theme];
        image.alt = (theme === "dark" ? "深色" : "浅色") + image.dataset.label;
        image.closest("a").href = image.dataset[theme];
      }
    });
  }
}
