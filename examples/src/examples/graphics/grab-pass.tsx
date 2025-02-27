import * as pc from '../../../../';


class GrabPassExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Grab Pass';
    static FILES = {
        'shader.vert': /* glsl */`
            attribute vec3 vertex_position;
            attribute vec2 vertex_texCoord0;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;

            varying vec2 texCoord;

            void main(void)
            {
                // project the position
                vec4 pos = matrix_model * vec4(vertex_position, 1.0);
                gl_Position = matrix_viewProjection * pos;

                texCoord = vertex_texCoord0;
            }
        `,
        'shader.frag': /* glsl */`
            precision mediump float;

            // use the special uSceneColorMap texture, which is a built-in texture. Each time this texture is used
            // for rendering, the engine will copy color framebuffer to it which represents already rendered scene
            uniform sampler2D uSceneColorMap;

            // normal map providing offsets
            uniform sampler2D uOffsetMap;

            // roughness map
            uniform sampler2D uRoughnessMap;

            // engine built-in constant storing render target size in .xy and inverse size in .zw
            uniform vec4 uScreenSize;

            varying vec2 texCoord;

            void main(void)
            {
                float roughness = 1.0 - texture2D(uRoughnessMap, texCoord).r;

                // sample offset texture - used to add distortion to the sampled background
                vec2 offset = texture2D(uOffsetMap, texCoord).rg;
                offset = 2.0 * offset - 1.0;

                // offset strength
                offset *= (0.2 + roughness) * 0.015;

                // get normalized uv coordinates for canvas
                vec2 grabUv = gl_FragCoord.xy * uScreenSize.zw;

                // roughness dictates which mipmap level gets used, in 0..4 range
                float mipmap = roughness * 5.0;

                // get background pixel color with distorted offset
                #ifdef GL2
                    // only webgl2 (and webgl1 extension - not handled here) supports reading specified mipmap
                    vec3 grabColor = texture2DLodEXT(uSceneColorMap, grabUv + offset, mipmap).rgb;
                #else
                    vec3 grabColor = texture2D(uSceneColorMap, grabUv + offset).rgb;
                #endif

                // brighten the refracted texture a little bit
                // brighten even more the rough parts of the glass
                gl_FragColor = vec4(grabColor * 1.1, 1.0) + roughness * 0.09;
            }
        `
    };

    example(canvas: HTMLCanvasElement, files: { 'shader.vert': string, 'shader.frag': string }): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {
            graphicsDeviceOptions: {
                alpha: true
            }
        });

        const assets = {
            'normal': new pc.Asset('normal', 'texture', { url: '/static/assets/textures/normal-map.png' }),
            "roughness": new pc.Asset("roughness", "texture", { url: "/static/assets/textures/pc-gray.png" }),
            'helipad.dds': new pc.Asset('helipad.dds', 'cubemap', { url: '/static/assets/cubemaps/helipad.dds' }, { type: pc.TEXTURETYPE_RGBM })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {
            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            // setup skydome
            app.scene.skyboxMip = 0;
            app.scene.exposure = 2;
            app.scene.setSkybox(assets['helipad.dds'].resources);

            app.scene.toneMapping = pc.TONEMAP_ACES;

            // Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
            // Move the depth layer to take place after World and Skydome layers, to capture both of them.
            const depthLayer = app.scene.layers.getLayerById(pc.LAYERID_DEPTH);
            app.scene.layers.remove(depthLayer);
            app.scene.layers.insertOpaque(depthLayer, 2);

            // helper function to create a primitive with shape type, position, scale, color
            function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, color: pc.Color) {
                // create material of specified color
                const material = new pc.StandardMaterial();
                material.diffuse = color;
                material.shininess = 60;
                material.metalness = 0.4;
                material.useMetalness = true;
                material.update();

                // create primitive
                const primitive = new pc.Entity();
                primitive.addComponent('render', {
                    type: primitiveType,
                    material: material
                });

                // set position and scale and add it to scene
                primitive.setLocalPosition(position);
                primitive.setLocalScale(scale);
                app.root.addChild(primitive);

                return primitive;
            }

            // create few primitives, keep their references to rotate them later
            const primitives: any = [];
            const count = 7;
            const shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
            for (let i = 0; i < count; i++) {
                const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
                const color = new pc.Color(Math.random(), Math.random(), Math.random());
                const angle = 2 * Math.PI * i / count;
                const pos = new pc.Vec3(12 * Math.sin(angle), 0, 12 * Math.cos(angle));
                primitives.push(createPrimitive(shapeName, pos, new pc.Vec3(4, 8, 4), color));
            }

            // Create the camera, which renders entities
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.2, 0.2, 0.2)
            });
            app.root.addChild(camera);
            camera.setLocalPosition(0, 10, 20);
            camera.lookAt(pc.Vec3.ZERO);

            // enable the camera to render the scene's color map.
            camera.camera.requestSceneColorMap(true);

            // create a primitive which uses refraction shader to distort the view behind it
            const glass = createPrimitive("box", new pc.Vec3(1, 3, 0), new pc.Vec3(10, 10, 10), new pc.Color(1, 1, 1));
            glass.render.castShadows = false;
            glass.render.receiveShadows = false;

            const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader');

            // reflection material using the shader
            const refractionMaterial = new pc.Material();
            refractionMaterial.shader = shader;
            glass.render.material = refractionMaterial;

            // set an offset map on the material
            refractionMaterial.setParameter('uOffsetMap', assets.normal.resource);

            // set roughness map
            refractionMaterial.setParameter('uRoughnessMap', assets.roughness.resource);

            // transparency
            refractionMaterial.blendType = pc.BLEND_NORMAL;
            refractionMaterial.update();

            app.start();

            // update things each frame
            let time = 0;
            app.on("update", function (dt) {
                time += dt;

                // rotate the primitives
                primitives.forEach((prim: pc.Entity) => {
                    prim.rotate(0.3, 0.2, 0.1);
                });

                glass.rotate(-0.1, 0.1, -0.15);

                // orbit the camera
                camera.setLocalPosition(20 * Math.sin(time * 0.2), 7, 20 * Math.cos(time * 0.2));
                camera.lookAt(new pc.Vec3(0, 2, 0));
            });
        });
    }
}

export default GrabPassExample;
