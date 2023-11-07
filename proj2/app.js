import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, mult } from "../../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale, pushMatrix, popMatrix, multTranslation } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as BUNNY from '../../libs/objects/bunny.js';
import * as TORUS from '../../libs/objects/torus.js';
import * as CUBE from '../../libs/objects/cube.js';
import * as PYRAMID from '../../libs/objects/pyramid.js';

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

const PLANET_SCALE = 10;    // scale that will apply to each planet and satellite
const ORBIT_SCALE = 1/60;   // scale that will apply to each orbit around the sun

const SUN_DIAMETER = 1391900;
const SUN_DAY = 24.47; // At the equator. The poles are slower as the sun is gaseous

const MERCURY_DIAMETER = 48660*PLANET_SCALE;
const MERCURY_ORBIT = 57950000*ORBIT_SCALE;
const MERCURY_YEAR = 87.97;
const MERCURY_DAY = 58.646;

const VENUS_DIAMETER = 121060*PLANET_SCALE;
const VENUS_ORBIT = 108110000*ORBIT_SCALE;
const VENUS_YEAR = 224.70;
const VENUS_DAY = 243.018;

const EARTH_DIAMETER = 12742*PLANET_SCALE;
const EARTH_ORBIT = 149570000*ORBIT_SCALE;
const EARTH_YEAR = 365.26;
const EARTH_DAY = 0.99726968;

const MOON_DIAMETER = 3474*PLANET_SCALE;
const MOON_ORBIT = 363396*ORBIT_SCALE;
const MOON_YEAR = 28;
const MOON_DAY = 0;

const VP_DISTANCE = EARTH_ORBIT;



function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);

    mode = gl.LINES; 

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function(event) {
        switch(event.key) {
            case 'w':
                mode = gl.LINES; 
                break;
            case 's':
                mode = gl.TRIANGLES;
                break;
            case 'p':
                animation = !animation;
                break;
            case '+':
                if(animation) speed *= 1.1;
                break;
            case '-':
                if(animation) speed /= 1.1;
                break;
        }
    }

    gl.clearColor(0.2, 0.0, 0.2, 1.0);
    SPHERE.init(gl);
    BUNNY.init(gl);
    TORUS.init(gl);
    CUBE.init(gl);
    PYRAMID.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function Sun()
    {
        // Don't forget to scale the sun, rotate it around the y axis at the correct speed
        multScale([SUN_DIAMETER * 3, SUN_DIAMETER * 3, SUN_DIAMETER * 3]);
        multRotationY(360*time/SUN_DAY);
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        // Draw a sphere representing the sun
        BUNNY.draw(gl, program, mode);
    }

    function Mercury(){
        //multRotationY(360*time/MERCURY_YEAR);
        //multTranslation([MERCURY_ORBIT, 0, 0]);
        multScale([SUN_DIAMETER, SUN_DIAMETER, SUN_DIAMETER]);
        multRotationY(360*time/MERCURY_DAY);

        uploadModelView();
        BUNNY.draw(gl, program, mode);
    }

    function Venus(){
        multRotationY(360*time/VENUS_YEAR);
        multTranslation([VENUS_ORBIT, 0, 0]);
        multScale([SUN_DIAMETER, SUN_DIAMETER, SUN_DIAMETER]);
        multRotationY(360*time/VENUS_DAY);

        uploadModelView();
        BUNNY.draw(gl, program, mode);
    }

    function Earth(){   
        multScale([SUN_DIAMETER, SUN_DIAMETER, SUN_DIAMETER]);
        multRotationY(360*time/EARTH_DAY);

        uploadModelView();
        PYRAMID.draw(gl, program, mode);
    }

    function Moon(){
        multRotationY(360*time/MOON_YEAR);
        multTranslation([MOON_ORBIT, 0, 0]);
        multScale([SUN_DIAMETER, SUN_DIAMETER, SUN_DIAMETER]);

        uploadModelView();
        TORUS.draw(gl, program, mode);
    }

    function EarthAndMoon(){
        multRotationY(360*time/EARTH_YEAR);
        multTranslation([EARTH_ORBIT, 0, 0]);
        pushMatrix();
        Earth();
        popMatrix();
        pushMatrix();
        Moon();
        popMatrix();  
    }

    function MercAndVen(){
        multRotationY(360*time/MERCURY_YEAR);
        multTranslation([MERCURY_ORBIT, 0, 0]);
        pushMatrix();
        Mercury();
        popMatrix();
        pushMatrix();
        Venus();
        popMatrix();  

    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        loadMatrix(lookAt([0,VP_DISTANCE,VP_DISTANCE], [0,0,0], [0,1,0]));

        pushMatrix();
        Sun();
        popMatrix();

        pushMatrix();
        EarthAndMoon();
        popMatrix();

        /*pushMatrix();
        Mercury();
        popMatrix();

        pushMatrix();
        Venus();
        popMatrix();*/

        pushMatrix();
        MercAndVen();
        popMatrix();
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
