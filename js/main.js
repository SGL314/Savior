function setup(){
    createCanvas(windowWidth*0.95, windowHeight*0.92);
    console.log('setup');
}

var runningTouch = false;

function draw(){
    background("#c5c5c5ff");
    loggus();
    areasTouch();

    if (mouseIsPressed || runningTouch){
        mousePressed();
    }
}

// function touchEnded(){
//     print("skip");
//     runningTouch = (mouseIsPressed) ? true : false;
// }
// function mouseReleased(){
//     print("skip");
//     runningTouch = (mouseIsPressed) ? true : false;
// }

class Cell{
    Cell(){
        px = 0, py = 0;
    }

}

function loggus(){
    
}

function mousePressed(){
    print(width + " " + height);
    runningTouch = true;
    var cnts = joystick();
    var cntx = cnts[0];
    var cnty = cnts[1];

    var dx = Math.abs(mouseX - cntx);
    var vx = mouseX - cntx;
    var dy = Math.abs(mouseY - cnty);
    var vy = mouseY - cnty;
    var d = Math.sqrt(dx*dx + dy*dy);

    if (d < height/4){
        stroke("#ff0000ff");
        line(cntx, cnty, cntx+vx, cnty);
        line(cntx+vx, cnty, cntx+vx, cnty+vy);
        stroke(2);
    }

    me.
}

function areasTouch(){
    // left
    fill("#d4d4d4ff");
    rect(0, 0, width/4, height);

    // right    
    fill("#d4d4d4ff");
    rect(3*width/4, 0, width, height);

    joystick();
}

function joystick(){
    // joystick
    var cntx = height/4;
    var cnty = 3*height/4;

    fill("#818181ff");
    circle(cntx, cnty, height/2);

    return [cntx, cnty];
}