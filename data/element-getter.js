self.port.on("getElements", function(tag) {
  var elements = document.getElementsByTagName(tag);
  for (var i = 0; i < elements.length; i++) {
    self.port.emit("gotElement", elements[i].innerHTML);
  }
});
console.log('element-getter.js loaded');