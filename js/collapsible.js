function toggleCol(id) {
  document.querySelectorAll(`.collapsible[data-colid="${id}"]`).forEach(el => {
      if (el.classList.contains("hide")) {
          el.classList.remove("hide");
          el.classList.add("show");
      } else if (el.classList.contains("show")) {
          el.classList.remove("show");
          el.classList.add("hide");
      }
  });
}
