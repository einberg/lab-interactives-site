/*globals energy2d: false, GL: false, Uint8Array: false, Float32Array: false */
/*jslint indent: 2, node: true, es5: true */
//
// lab/energy2d-utils/gpgpu.js
//

// define namespace
energy2d.namespace('energy2d.utils.gpu.gpgpu');

// GPGPU Utils (singleton, one instance in the environment).
energy2d.utils.gpu.gpgpu = (function () {
  'use strict';
  var
    // Enhanced WebGL context (enhanced by lightgl).
    gl,

    // GPGPU utils must know dimensions of data (grid).
    // This assumtion that all the textures will have the same dimensions is 
    // caused by performance reasons (helps avoiding recreating data structures).
    // To set grid dimensions and initialize WebGL context, call init(grid_width, grid_height).
    grid_width,
    grid_height,

    // Texture used as a temporary storage (Float, RGBA).
    temp_texture,
    // Texture used for Float to RGBA conversion (Unsigned Byte, RGBA).
    output_texture,
    // Array (Float32Array) used as temporal storage during writing RGBA textures.
    temp_storage,
    // Mesh used for rendering.
    plane,

    // Special shader for encoding floats based on: 
    // https://github.com/cscheid/facet/blob/master/src/shade/bits/encode_float.js
    encode_program,
    copy_program,

    // GLSL sources.
    basic_vertex_shader =
    '\
    varying vec2 coord;\
    void main() {\
      coord = gl_Vertex.xy * 0.5 + 0.5;\
      gl_Position = vec4(gl_Vertex.xyz, 1.0);\
    }',

    encode_fragment_shader =
    '\
    uniform sampler2D texture;\
    varying vec2 coord;\
    float shift_right(float v, float amt) {\
      v = floor(v) + 0.5;\
      return floor(v / exp2(amt));\
    }\
    float shift_left(float v, float amt) {\
      return floor(v * exp2(amt) + 0.5);\
    }\
    \
    float mask_last(float v, float bits) {\
      return mod(v, shift_left(1.0, bits));\
    }\
    float extract_bits(float num, float from, float to) {\
      from = floor(from + 0.5);\
      to = floor(to + 0.5);\
      return mask_last(shift_right(num, from), to - from);\
    }\
    vec4 encode_float(float val) {\
      if (val == 0.0)\
        return vec4(0, 0, 0, 0);\
      float sign = val > 0.0 ? 0.0 : 1.0;\
      val = abs(val);\
      float exponent = floor(log2(val));\
      float biased_exponent = exponent + 127.0;\
      float fraction = ((val / exp2(exponent)) - 1.0) * 8388608.0;\
      \
      float t = biased_exponent / 2.0;\
      float last_bit_of_biased_exponent = fract(t) * 2.0;\
      float remaining_bits_of_biased_exponent = floor(t);\
      \
      float byte4 = extract_bits(fraction, 0.0, 8.0) / 255.0;\
      float byte3 = extract_bits(fraction, 8.0, 16.0) / 255.0;\
      float byte2 = (last_bit_of_biased_exponent * 128.0 + extract_bits(fraction, 16.0, 23.0)) / 255.0;\
      float byte1 = (sign * 128.0 + remaining_bits_of_biased_exponent) / 255.0;\
      return vec4(byte4, byte3, byte2, byte1);\
    }\
    void main() {\
      vec4 data = texture2D(texture, coord);\
      gl_FragColor = encode_float(data.r);\
    }',

    copy_fragment_shader =
    '\
    uniform sampler2D texture;\
    varying vec2 coord;\
    void main() {\
      gl_FragColor = texture2D(texture, coord);\
    }',

    // Common error messages.
    INIT_ERR = 'GPGPU: call init(grid_width, grid_height) with proper dimensions first!';

  //
  // Public API.
  //
  return {
    // Setups rendering context (only during first call) and necessary storage (texture, array).
    init: function (width, height, gl_ctx) {
      if (gl === undefined) {
        if (typeof GL === 'undefined') {
          throw new Error("GPGPU: lightgl.js library missing.");
        }
        if (gl_ctx) {
          // Use provided context.
          gl = ready_gl_ctx;
        } else {
          // Setup WebGL context.
          gl = GL.create({ alpha: true });
        }
        if (!gl.getExtension('OES_texture_float')) {
          throw new Error("GPGPU: OES_texture_float is not supported!");
        }
        gl.disable(gl.DEPTH_TEST);
        plane = GL.Mesh.plane({ coords: true });
        encode_program = new GL.Shader(basic_vertex_shader, encode_fragment_shader);
        copy_program = new GL.Shader(basic_vertex_shader, copy_fragment_shader);
      }
      // Set dimensions.
      grid_width = width;
      grid_height = height;

      // Setup storage for given dimensions.
      temp_texture   = new GL.Texture(grid_width, grid_height, { type: gl.FLOAT, format: gl.RGBA, filter: gl.NEAREST });
      output_texture = new GL.Texture(grid_width, grid_height, { type: gl.UNSIGNED_BYTE, format: gl.RGBA, filter: gl.NEAREST });
      temp_storage   = new Float32Array(grid_width * grid_height * 4);

      // lightgl.js sets this parameter to 1 during each GL.Texture call, so overwrite it.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    },

    // Creates a floating point texture with proper parameters.
    createTexture: function () {
      var tex;
      if (!grid_width || !grid_height) {
        return new Error(INIT_ERR);
      }
      // Use RGBA format as this is the safest option. Single channel textures aren't well supported
      // as render targets attached to FBO.
      tex = new GL.Texture(grid_width, grid_height, { type: gl.FLOAT, format: gl.RGBA, filter: gl.NEAREST });
      // lightgl.js sets this parameter to 1 during each GL.Texture call, so overwrite it.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

      return tex;
    },

    // Convert given array to the RGBA FLoat32Array (which can be used
    // in the writeTexture function) and fill one of its channel.
    // Channel should be between 0 and 3, where 0 = R, 1 = G, 2 = B and 3 = A.
    convertToRGBA: function (data, channel, output) {
      var rgba, i, len, i4;

      if (data.length !== grid_width * grid_height) {
        throw new Error("GPGPU: Invalid input data length.");
      }

      if (output === undefined) {
        rgba = new Float32Array(data.length * 4);
      } else {
        rgba = output;
      }

      if (channel === undefined) {
        channel = 0;
      }

      // Fill RGBA array.
      for (i = 0, len = data.length; i < len; i += 1) {
        i4 = i * 4;
        rgba[i4] = rgba[i4 + 1] = rgba[i4 + 2] = rgba[i4 + 3] = 0;
        rgba[i4 + channel] = data[i];
      }

      return rgba;
    },

    // Write a texture.
    writeTexture: function (tex, input) {
      var rgba;
      if (input.length === tex.width * tex.height) {
        rgba = this.convertToRGBA(input, 0, temp_storage);
      } else if (input.length === 4 * tex.width * tex.height) {
        rgba = input;
      } else {
        throw new Error("GPGPU: Invalid dimensions of input array.");
      }
      // Make sure that texture is bound.
      gl.bindTexture(gl.TEXTURE_2D, tex.id);
      gl.texImage2D(gl.TEXTURE_2D, 0, tex.format, tex.width, tex.height, 0, tex.format, tex.type, rgba);
    },

    // Read a floating point texture.
    // Returns Float32Array.
    readTexture: function (tex, output) {
      var output_storage, i, j;
      if (!gl || tex.width !== grid_width || tex.height !== grid_height) {
        return new Error(INIT_ERR);
      }

      // Use buffer of provided ouput array. So, when result is written there,
      // output is automaticaly updated in a right way.
      output_storage = new Uint8Array(output.buffer);

      output_texture.drawTo(function () {
        tex.bind();
        encode_program.draw(plane);
        // format: gl.RGBA, type: gl.UNSIGNED_BYTE - only this set is accepted by WebGL readPixels.
        gl.readPixels(0, 0, output_texture.width, output_texture.height, output_texture.format, output_texture.type, output_storage);
      });
    },

    copyTexture: function (src_tex, dst_tex) {
      dst_tex.drawTo(function () {
        src_tex.bind();
        copy_program.draw(plane);
      });
    },

    // Execute a GLSL program.
    // Arguments:
    // - program - GL.Shader
    // - textures - array of GL.Texture
    // - uniforms - object with uniforms (e.g. { float_uniform: 0.125, val: 5.0 })
    // - output - output texture
    executeProgram: function (program, textures, uniforms, output) {
      var i, len;
      // Use temp texture as writing and reading from the same texture is impossible.
      temp_texture.drawTo(function () {
        // Bind textures for reading.
        for (i = 0, len = textures.length; i < len; i += 1) {
          textures[i].bind(i);
        }
        // Draw simple plane (coordinates x/y from -1 to 1 to cover whole viewport).
        program.uniforms(uniforms).draw(plane);
        // Unbind textures.
        for (i = 0, len = textures.length; i < len; i += 1) {
          textures[i].unbind(i);
        }
      });
      output.swapWith(temp_texture);
    }
  };

}());
