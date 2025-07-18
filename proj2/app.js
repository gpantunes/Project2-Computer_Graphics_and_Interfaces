import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten } from "../../libs/MV.js";
import {
    modelView,
    loadMatrix,
    multRotationY,
    multScale,
    pushMatrix,
    popMatrix,
    multRotationX,
    multTranslation,
} from "../../libs/stack.js";


import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js';


/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

let angles;
let scale;

let axoview = true;

let folder;
let program;
let hookOpen;


const GROUND_LENGTH = 65;

//Base constants
const BASE_SQUARE_SIDE = 2;
const BASE_SQUARE_COUNT = 10;

//Lift constants
const LIFT_SQUARE_SIDE = 0.8;
const LIFT_SQUARE_COUNT = 12;
const BASE_LIFT_OFFSET = 0.5*BASE_SQUARE_SIDE;

//Boom constants
const BOOM_SIZE = 20;               //PRE: BOOM_SIZE >= 10
const HOOK_DESCENT_OFFSET = 5;

const BLOCK_DESCENT_RATE = 0.1;

const zoom = 30.0;

let blockY;
let blockDropped = false;
let blockRotation;
let blockTrolleyPosition;

let mView;




function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection =ortho(-aspect*zoom,aspect*zoom, -zoom, zoom,0,5000);

    angles = {
        theta: 50,
        gamma: 15,
    }

    mView = lookAt([0, 0, 200], [0, 0, 0], [0, 1, 0]);

    mode = gl.LINES;
    scale = 1;

    resize_canvas();
    window.addEventListener("resize", resize_canvas);
    


    let BASE_LIFT = Math.max(0, (BASE_SQUARE_COUNT-LIFT_SQUARE_COUNT)*BASE_SQUARE_SIDE)                 //The last value is used to avoid deformation if BASE_SQUARE_COUNT > LIFT_SQUARE_COUNT
    let ROTATION_ANGLE = 0;
    let TROLLEY_POSITION = 8;
    let HOOK_LENGTH = 10;
    hookOpen = false;




    document.onkeydown = function(event) {
        switch(event.key) {
            case 'w':
                HOOK_LENGTH = Math.max(0, HOOK_LENGTH-HOOK_DESCENT_OFFSET)
                break;
            case 's':
                HOOK_LENGTH = Math.min(101+BASE_LIFT*BASE_SQUARE_SIDE*2.5, HOOK_LENGTH+HOOK_DESCENT_OFFSET);
                break;
            case 'a':
                TROLLEY_POSITION = Math.min(BOOM_SIZE-1, TROLLEY_POSITION+1);
                break;
            case 'd':
                TROLLEY_POSITION = Math.max(8, TROLLEY_POSITION-1);
                break;
            case 'l':
                ROTATION_ANGLE -= 5;
                break;
            case 'j':
                ROTATION_ANGLE += 5;
                break;
            case 'r':
                angles.theta = 50;
                angles.gamma = 15;
                break;
            case '+':
                if(animation) speed *= 1.1;
                break;
            case '-':
                if(animation) speed /= 1.1;
                break;
            case '0':
                if(mode == gl.TRIANGLES) mode = gl.LINES;
                else mode = gl.TRIANGLES;
                break;
            case '1':
                // Front view
                mView = lookAt([0, 0, 200], [0, 0, 0], [0, 1, 0]);
                axoview = false;
                break;
            case '2':
                // Top view
                mView = lookAt([0, 200, 0], [0, 0, 0], [0, 0, -1]);
                axoview = false;
                break;
            case '3':
                // Right view
                mView = lookAt([200, 0, 0], [0, 0, 0], [0, 1, 0]);
                axoview = false;
                break;
            case '4':
                //Axonometric view
                axoview = true;
                break;
            case 'i':
                BASE_LIFT = Math.min(BASE_LIFT+BASE_LIFT_OFFSET, (BASE_SQUARE_COUNT-2)*BASE_SQUARE_SIDE);
                break;
            case 'k':
                //The second Math.max is used to avoid deformation if BASE_SQUARE_COUNT > LIFT_SQUARE_COUNT
                BASE_LIFT = Math.max(BASE_LIFT-BASE_LIFT_OFFSET, Math.max(0, (BASE_SQUARE_COUNT-LIFT_SQUARE_COUNT)*BASE_SQUARE_SIDE));
                HOOK_LENGTH = Math.min(101+BASE_LIFT*BASE_SQUARE_SIDE*2.5, HOOK_LENGTH);
                break;
            case 'ArrowLeft':
                angles.theta += 5;
                if(angles.theta >= 360) angles.theta -= 360;
                break;
            case 'ArrowRight':
                angles.theta -= 5;
                if(angles.theta < 0) angles.theta += 360;
                break;
            case 'ArrowUp':
                angles.gamma += 5;
                if(angles.gamma >= 360) angles.gamma -= 360;
                break;
            case 'ArrowDown':
                angles.gamma -= 5;
                if(angles.gamma < 0) angles.gamma += 360;
                break;
            case '9':
                hookOpen = !hookOpen;
                if (hookOpen && !blockDropped){
                    blockDropped = true;
                }
                else if (!hookOpen && blockDropped){
                    if(HOOK_LENGTH == 101+BASE_LIFT*BASE_SQUARE_SIDE*2.5 && TROLLEY_POSITION == blockTrolleyPosition && Math.abs(ROTATION_ANGLE-blockRotation) <= 5){
                        blockDropped = false;
                    }
                }
        }
    }

    document.addEventListener("wheel", function(event){
        var deltaY = event.deltaY;
        //scroll down
        if (deltaY > 0) {
           scale -= 0.05;
           if(scale < 0.05) scale = 0.05;
        }
        //scroll up
        else if (deltaY < 0) {
            scale += 0.05;
        }
    });

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);

    gl.enable(gl.DEPTH_TEST);
    
    window.requestAnimationFrame(render);

    
    function axonometric(){
        let m = lookAt([-200, 0, 0], [0, 0, 0], [0, 1, 0]);
        pushMatrix()
        loadMatrix(m)
        multRotationY(angles.theta)
        multRotationX(-angles.gamma)
        uploadModelView(program)
        mView = modelView()
        popMatrix()
    }
    
    function resize_canvas()
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection =ortho(-aspect*zoom,aspect*zoom, -zoom, zoom,0,500);

    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        if(axoview) axonometric()

        loadMatrix(mView);
        multScale([scale, scale, scale]);
        ground();
        crane(BASE_LIFT, ROTATION_ANGLE, TROLLEY_POSITION, HOOK_LENGTH);
    }
}


function uploadModelView() {
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
}

function changeColor(rgb, ){
    gl.uniform3fv(gl.getUniformLocation(program, "uColor"), rgb);
}

function ground() {
    pushMatrix();
    gl.uniform1f(gl.getUniformLocation(program, "mGroundLength"), GROUND_LENGTH);
    multScale([GROUND_LENGTH, 1, GROUND_LENGTH])
    uploadModelView();
    CUBE.draw(gl, program, gl.TRIANGLES);
    gl.uniform1f(gl.getUniformLocation(program, "mGroundLength"), 0.0);
    popMatrix();
}

function base(){
    changeColor([1.0, 1.0, 0.0]);
    multTranslation([0.0, (BASE_SQUARE_SIDE+1)*0.5+0.05, 0.0])
    for (let i = 0; i < BASE_SQUARE_COUNT; i++){
        pushMatrix()
        multScale([BASE_SQUARE_SIDE, BASE_SQUARE_SIDE, BASE_SQUARE_SIDE]);
        multTranslation([0, i, 0]);
        uploadModelView();
        CUBE.draw(gl, program, mode);
        popMatrix();
    }
}

function baseLift(BASE_LIFT){
    changeColor([1.0, 1.0, 0.0]);
    multTranslation([0.0, (BASE_SQUARE_SIDE+1)*0.5+0.05+BASE_LIFT, 0.0])
    for (let i = 0; i < LIFT_SQUARE_COUNT; i++){
        if(i < LIFT_SQUARE_COUNT-1) pushMatrix();
        multScale([LIFT_SQUARE_SIDE, BASE_SQUARE_SIDE, LIFT_SQUARE_SIDE]);
        multTranslation([0, i, 0]);
        uploadModelView();
        CUBE.draw(gl, program, mode);
        if(i < LIFT_SQUARE_COUNT-1) popMatrix();
    }
}

function rotationCylinder(ROTATION_ANGLE){
    changeColor([0.5, 0.5, 0.5]);
    multScale([3, 0.5, 3]);
    multRotationY(ROTATION_ANGLE);
    multTranslation([0, 1.5, 0]);
    uploadModelView();
    CYLINDER.draw(gl, program, mode);
}

function boom(){
    changeColor([1.0, 0.0, 0.0]);
    multTranslation([0.0, 1.6, -4*0.7])
    multScale([0.7, 2.0, 0.7]);
    for (let i = 0; i < BOOM_SIZE; i++){
        pushMatrix();
        multRotationX(90);
        multTranslation([0, i, 0]);
        uploadModelView();
        CUBE.draw(gl, program, mode);
        popMatrix();
    }
}

function trolley(TROLLEY_POSITION){
    changeColor([0.0, 1.0, 0.0]);
    multScale([1.0, 0.1, 1.0]);
    multTranslation([0.0, -6.0, TROLLEY_POSITION]);
    uploadModelView();
    CUBE.draw(gl, program, mode);
}


function wireRope(HOOK_LENGTH){
    pushMatrix();
        changeColor([1.0, 1.0, 1.0]);
        multTranslation([0.0, -1.0-HOOK_LENGTH/2, 0.0]);
        multScale([0.1, HOOK_LENGTH, 0.1]);
        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    popMatrix();
}

function counterWeight(){
    pushMatrix()
    changeColor([1.0, 1.0, 1.0]);
    multScale([1.0, 1.5, 1.0]);
    multTranslation([0.0, -0.82, 1.0]);
    uploadModelView();
    CUBE.draw(gl, program, mode);
    popMatrix();
}

function hook (HOOK_LENGTH){
    changeColor([0.0, 0.0, 1.0]);
    //Fixed right part
    pushMatrix()
        multTranslation([0.0, -HOOK_LENGTH-1.05, 0.6]);
        multRotationX(90);
        multScale([0.2, 1.5, 0.2])
        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    popMatrix()
    //Fixed left part
    pushMatrix()
        multTranslation([0.0, -HOOK_LENGTH-1.05, -0.6]);
        multRotationX(90);
        multScale([0.2, 1.5, 0.2])
        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    popMatrix()
    //Movable right part
    changeColor([0.0, 1.0, 0.0])
    pushMatrix()
        if(hookOpen) multTranslation([0.0, -HOOK_LENGTH-1.4, 2.1]);
        else multTranslation([0.0, -HOOK_LENGTH-6.4, 1.4]);
        multRotationX(90);
        if(hookOpen) multScale([0.2, 1.5, 0.2])
        else multScale([0.2, 0.2, 10.0])
        uploadModelView();
        CYLINDER.draw(gl, program, gl.TRIANGLES);
    popMatrix()
    //Movable left part
    pushMatrix()
        if(hookOpen) multTranslation([0.0, -HOOK_LENGTH-1.4, -2.1]);
        else multTranslation([0.0, -HOOK_LENGTH-6.4, -1.4]);
        multRotationX(90);
        if(hookOpen) multScale([0.2, 1.5, 0.2])
        else multScale([0.2, 0.2, 10.0])
        uploadModelView();
        CYLINDER.draw(gl, program, gl.TRIANGLES);
    popMatrix()
}
function drawBlock(ROTATION_ANGLE, TROLLEY_POSITION, BASE_LIFT, HOOK_LENGTH){
    changeColor([0.5, 0.5, 1.0])
    if(!blockDropped){
        blockRotation = ROTATION_ANGLE;
        blockTrolleyPosition = TROLLEY_POSITION;
    }
    multScale([4.0, 4.0, 4.0])
    multRotationY(blockRotation);
    if(blockDropped) blockY = Math.max(0.65,blockY-BLOCK_DESCENT_RATE)
    else blockY = BASE_LIFT/4-HOOK_LENGTH/20.0+5.7;
    multTranslation([0.0, blockY, blockTrolleyPosition/2.37-1.7])
    uploadModelView()
    CUBE.draw(gl, program, mode);
}


function crane(BASE_LIFT, ROTATION_ANGLE, TROLLEY_POSITION, HOOK_LENGTH){
        pushMatrix()
            base();
        popMatrix();
        pushMatrix();
            baseLift(BASE_LIFT);
            rotationCylinder(ROTATION_ANGLE);
            pushMatrix();
                boom();
                pushMatrix();
                    counterWeight();
                    trolley(TROLLEY_POSITION);
                    pushMatrix();
                        wireRope(HOOK_LENGTH);
                        hook(HOOK_LENGTH);
                    popMatrix();
                popMatrix();
            popMatrix();
        popMatrix();
        pushMatrix()
            drawBlock(ROTATION_ANGLE, TROLLEY_POSITION, BASE_LIFT, HOOK_LENGTH);
        popMatrix()
    }




const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))