import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, mult } from "../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale, pushMatrix, popMatrix, multRotationX, multTranslation, multRotationZ } from "../libs/stack.js";
import { GUI } from "../libs/dat.gui.module.js"


import * as SPHERE from '../libs/objects/sphere.js';
import * as CUBE from '../libs/objects/cube.js';
import * as CYLINDER from '../libs/objects/cylinder.js';
import * as PYRAMID from '../libs/objects/pyramid.js';


/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

let angles;

let axoview = true;


const GROUND_LENGTH = 65;

//Base constants
const BASE_SQUARE_SIDE = 1;
const BASE_SQUARE_COUNT = 20;       //TODO: FIX WHEN BASE_SQUARE_COUNT > LIFT_SQUARE_COUNT

//Lift constants
const LIFT_SQUARE_SIDE = 0.8;
const LIFT_SQUARE_COUNT = 15;
const BASE_LIFT_OFFSET = 0.5*BASE_SQUARE_SIDE;

//Boom constants
const BOOM_SIZE = 20;               //PRE: BOOM_SIZE >= 10

const zoom = 30.0;


let BASE_LIFT = 0;
let ROTATION_ANGLE = 0;
let TROLLEY_POSITION = 7;
let HOOK_LENGTH = 10;

let folder;


function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection =ortho(-aspect*zoom,aspect*zoom, -zoom, zoom,0,5000);

    let mView = lookAt([0, 0, 200], [0, 0, 0], [0, 1, 0]);

    mode = gl.LINES;

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function(event) {
        switch(event.key) {
            case 'w':
                HOOK_LENGTH += 5;
                if(HOOK_LENGTH > 210) HOOK_LENGTH = 210; 
                break;
            case 's':
                HOOK_LENGTH -= 5;
                if(HOOK_LENGTH < 0) HOOK_LENGTH = 0;
                break;
            case 'a':
                TROLLEY_POSITION = Math.min(BOOM_SIZE-1, TROLLEY_POSITION+1);
                break;
            case 'd':
                TROLLEY_POSITION = Math.max(7, TROLLEY_POSITION-1);
                break;
            case 'l':
                ROTATION_ANGLE -= 5;
                break;
            case 'j':
                ROTATION_ANGLE += 5;
                break;
            case 'r':
                angles.theta = 0;
                angles.gamma = 0;
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
                mView = lookAt([0, 100, 300], [0, 10, 0], [0, 1, 0]);
                axoview = false;
                break;
            case '2':
                // Top view
                mView = lookAt([0, 500, 0], [0, 0, 0], [0, 0, -1]);
                axoview = false;
                break;
            case '3':
                // Right view
                mView = lookAt([1, 0, 0], [0, 0, 0], [0, 1, 0]);
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
                BASE_LIFT = Math.max(BASE_LIFT-BASE_LIFT_OFFSET, 0);
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
        }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);

    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);

    doGUI()

    function axonometric(){
        let m = lookAt([-200, 0, 0], [0, 0, 0], [0, 1, 0]);
        pushMatrix()
        loadMatrix(m)
        multRotationY(angles.theta)
        multRotationX(-angles.gamma)
        uploadModelView()
        mView = modelView()
        popMatrix()
    }
    function doGUI(){
        angles = {
            theta: 50,
            gamma: 15,
            dummy: function () {}
        }
        const gui = new GUI()
        folder = gui.addFolder('Angles')
        folder.add(angles, 'theta', 0.0, 360)
        folder.add(angles, "gamma", 0.0, 360)
        folder.open()
    }

    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection =ortho(-aspect*zoom,aspect*zoom, -zoom, zoom,0,500);

    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function changeColor(rgb){
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), rgb);
    }

    function ground()
    {
        gl.uniform1f(gl.getUniformLocation(program, "mGroundLength"), GROUND_LENGTH*1.0);
        multScale([GROUND_LENGTH, 1, GROUND_LENGTH])
        uploadModelView();
        CUBE.draw(gl, program, gl.TRIANGLES);
        gl.uniform1f(gl.getUniformLocation(program, "mGroundLength"), 0.0);

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

    function baseLift(){
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
    function rotationCylinder(){
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

    function trolley(){
        changeColor([0.0, 1.0, 0.0]);
        multScale([1.0, 0.1, 1.0]);
        multTranslation([0.0, -6.0, TROLLEY_POSITION]);
        uploadModelView();
        CUBE.draw(gl, program, gl.TRIANGLES);
    }

    function hook(){
        changeColor([1.0, 1.0, 1.0]);
        for(let i = 0; i < HOOK_LENGTH; i++){
            pushMatrix();
            multScale([0.1, 0.5, 0.1]);
            multRotationZ(-90);
            multTranslation([i+0.6, 0.0, 0.0]);
            uploadModelView();
            CUBE.draw(gl, program, gl.TRIANGLES);
            popMatrix();
        }
    }

    function counterWeight(){
        pushMatrix()
        changeColor([1.0, 1.0, 1.0]);
        multScale([1.0, 1.5, 1.0]);
        multTranslation([0.0, -0.82, 1.0]);
        uploadModelView();
        CUBE.draw(gl, program, gl.TRIANGLES);
        popMatrix();
    }


    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        if(axoview) axonometric()

        folder.updateDisplay()

        loadMatrix(mView);
        pushMatrix()
            ground();
        popMatrix()
        pushMatrix()
            base();
        popMatrix();
        pushMatrix();
            baseLift();
            rotationCylinder();
            pushMatrix();
                boom();
                pushMatrix();
                    counterWeight();
                    trolley();
                    pushMatrix();
                        hook();
                    popMatrix()
                popMatrix()
            popMatrix()
        popMatrix();
    }


}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))