precision highp float;

varying vec3 fNormal;

uniform vec3 uColor;

void main() {
    gl_FragColor = vec4(fNormal, 1.0);
}

