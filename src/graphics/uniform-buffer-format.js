import { Debug } from '../core/debug.js';
import {
    UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3,
    UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2,
    UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT4
} from './constants.js';

/** @typedef {import('./uniform-buffer.js').UniformBuffer} UniformBuffer */

// map of UNIFORMTYPE_*** to byte size
const uniformTypeToByteSize = [];
uniformTypeToByteSize[UNIFORMTYPE_FLOAT] = 4;
uniformTypeToByteSize[UNIFORMTYPE_VEC2] = 8;
uniformTypeToByteSize[UNIFORMTYPE_VEC3] = 12;
uniformTypeToByteSize[UNIFORMTYPE_VEC4] = 16;
uniformTypeToByteSize[UNIFORMTYPE_INT] = 4;
uniformTypeToByteSize[UNIFORMTYPE_IVEC2] = 8;
uniformTypeToByteSize[UNIFORMTYPE_IVEC3] = 12;
uniformTypeToByteSize[UNIFORMTYPE_IVEC4] = 16;
uniformTypeToByteSize[UNIFORMTYPE_BOOL] = 4;
uniformTypeToByteSize[UNIFORMTYPE_BVEC2] = 8;
uniformTypeToByteSize[UNIFORMTYPE_BVEC3] = 12;
uniformTypeToByteSize[UNIFORMTYPE_BVEC4] = 16;
uniformTypeToByteSize[UNIFORMTYPE_MAT4] = 64;

// Handle additiona types:
//      UNIFORMTYPE_MAT2 = 12;
//      UNIFORMTYPE_MAT3 = 13;
//      UNIFORMTYPE_TEXTURE2D = 15;
//      UNIFORMTYPE_TEXTURECUBE = 16;
//      UNIFORMTYPE_FLOATARRAY = 17;
//      UNIFORMTYPE_TEXTURE2D_SHADOW = 18;
//      UNIFORMTYPE_TEXTURECUBE_SHADOW = 19;
//      UNIFORMTYPE_TEXTURE3D = 20;
//      UNIFORMTYPE_VEC2ARRAY = 21;
//      UNIFORMTYPE_VEC3ARRAY = 22;
//      UNIFORMTYPE_VEC4ARRAY = 23;

/**
 * A class storing description of an individual uniform, stored inside a uniform buffer.
 *
 * @ignore
 */
class UniformFormat {
    /** @type {string} */
    name;

    // UNIFORMTYPE_***
    /** @type {number} */
    type;

    /** @type {number} */
    byteSize;

    /**
     * Index of the uniform in an array of 32bit values (Float32Array and similar)
     *
     * @type {number}
     */
    offset;

    // TODO: add count for arrays

    constructor(name, type) {
        this.name = name;
        this.type = type;
        this.byteSize = uniformTypeToByteSize[type];
        Debug.assert(this.byteSize, `Unknown byte size for uniform format ${type} used for ${name}`);
    }
}

/**
 * A descriptor that defines the layout of of data inside the {@link UniformBuffer}.
 *
 * @ignore
 */
class UniformBufferFormat {
    /** @type {number} */
    byteSize = 0;

    /** @type {Map<string,UniformFormat>} */
    map = new Map();

    /**
     * Create a new UniformBufferFormat instance.
     *
     * @param {UniformFormat[]} uniforms - An array of uniforms to be stored in the buffer
     */
    constructor(uniforms) {
        /** @type {UniformFormat[]} */
        this.uniforms = uniforms;

        // TODO: optimize uniforms ordering

        let byteSize = 0;
        for (let i = 0; i < uniforms.length; i++) {
            const uniform = uniforms[i];
            uniform.offset = byteSize / 4;
            byteSize += uniform.byteSize;

            this.map.set(uniform.name, uniform);
        }
        this.byteSize = byteSize;
    }
}

export { UniformFormat, UniformBufferFormat };
