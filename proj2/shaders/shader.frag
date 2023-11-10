precision highp float;

varying vec3 fNormal;
varying vec4 fPosition;

uniform vec3 uColor;
uniform float mGroundLength;


void main() {
    float SQUARES_PER_ROW = 40.0;
    if(mGroundLength != 0.0){       //drawing the ground
        bool evenrowpos = mod(fPosition.x/(mGroundLength/SQUARES_PER_ROW),0.1)<0.05;
        bool evencolpos = mod(fPosition.z/(mGroundLength/SQUARES_PER_ROW),0.1)<0.05;
        if(evenrowpos == evencolpos) gl_FragColor = vec4(0.3, 0.3, 0.3, 1.0);
        else gl_FragColor = vec4(0.7, 0.7, 0.7, 1.0);
    }
    else gl_FragColor = vec4(uColor, 1.0);
}