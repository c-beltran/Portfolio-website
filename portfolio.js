/*loading animation bar*/

//this function gets the height of the whole html document
function getDocHeight() {
  var doc = document;
  return Math.max(
    doc.body.scrollHeight, doc.documentElement.scrollHeight,
    doc.body.offsetHeight, doc.documentElement.offsetHeight,
    doc.body.clientHeight, doc.documentElement.clientHeight
    )
}

//calculates the amount the person scrolls down and up a page
function amountscrolled(){
  var golang = document.getElementById("golang");
  var html = document.getElementById("html");
  var css = document.getElementById("css");
  var js = document.getElementById("js");
  var node = document.getElementById("node");
  var pg = document.getElementById("pg");
  var git = document.getElementById("git");
  var glab = document.getElementById("glab");
  var cloudf = document.getElementById("cloudf");
  var upArrow = document.getElementById("toggle-up");
  var home = document.getElementById("home");
  var id = setInterval(frame, 10);

  var winheight= window.innerHeight || (document.documentElement || document.body).clientHeight
  var docheight = getDocHeight()
  var scrollTop = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop
  var trackLength = docheight - winheight
  var pctScrolled = Math.floor(scrollTop/trackLength * 100) // gets percentage scrolled (ie: 80 or NaN if tracklength == 0)
  console.log(pctScrolled + '% scrolled')

    //if person reaches a certain length down a page than we show the progress bars
    function frame() {
      if (pctScrolled >= 100) {
        clearInterval(id);
      }
      else if(pctScrolled == 15){
        golang.style.width = 87 + '%';
        html.style.width = 82 + '%';
        css.style.width = 70 + '%';
        js.style.width = 70 + '%';
        node.style.width = 70 + '%';
        pg.style.width = 80 + '%';
        git.style.width = 85 + '%';
        glab.style.width = 50 + '%';
        cloudf.style.width = 75 + '%';
      }
      else if(pctScrolled == 25){
        golang.style.width = 87 + '%';
        html.style.width = 82 + '%';
        css.style.width = 70 + '%';
        js.style.width = 70 + '%';
        node.style.width = 70 + '%';
        pg.style.width = 80 + '%';
        git.style.width = 85 + '%';
        glab.style.width = 50 + '%';
        cloudf.style.width = 75 + '%';
      }
      else if(pctScrolled == 35){
        golang.style.width = 87 + '%';
        html.style.width = 82 + '%';
        css.style.width = 70 + '%';
        js.style.width = 70 + '%';
        node.style.width = 70 + '%';
        pg.style.width = 80 + '%';
        git.style.width = 85 + '%';
        glab.style.width = 50 + '%';
        cloudf.style.width = 75 + '%';
      }
    }
  }

  function openCard(){
    var back = document.getElementById("flip-back")
    var front = document.getElementById("flip-front")

    if (back.style.display === "none") {
      back.style.display = "block";
      front.style.display = "none"
    } else {
      front.style.display = "block"
      back.style.display = "none"
    }
  }

  window.addEventListener("scroll", function(){
    amountscrolled()
  }, false)

