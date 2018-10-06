/*loading bar animation*/

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
  var html = document.getElementById("html");
  var css = document.getElementById("css");
  var js = document.getElementById("js");
  var node = document.getElementById("node");
  var java = document.getElementById("java");      
  var ror = document.getElementById("ruby");
  var git = document.getElementById("git");
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
        html.style.width = 85 + '%';
        css.style.width = 65 + '%';
        js.style.width = 70 + '%';
        node.style.width = 70 + '%';
        java.style.width = 75 + '%';
        ror.style.width = 50 + '%';
        git.style.width = 85 + '%';
      }
      else if(pctScrolled == 25){
        html.style.width = 85 + '%';
        css.style.width = 65 + '%';
        js.style.width = 70 + '%';
        node.style.width = 70 + '%';
        java.style.width = 75 + '%';
        ror.style.width = 50 + '%';
        git.style.width = 85 + '%';
      }
      else if(pctScrolled == 35){
        html.style.width = 85 + '%';
        css.style.width = 65 + '%';
        js.style.width = 70 + '%';
        node.style.width = 70 + '%';
        java.style.width = 75 + '%';
        ror.style.width = 50 + '%';
        git.style.width = 85 + '%';
      }
    }   
  }

  window.addEventListener("scroll", function(){
    amountscrolled()
  }, false)

