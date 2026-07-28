import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { fontSize, fontWeight, radius, spacing, useColors } from '../theme';
import { AppText as Text } from './AppText';
import { LastShot } from './FieldView';

interface Props {
  lastShot?: LastShot | null;
  onUnavailable?: () => void;
  theme?: 'classic' | 'noir';
}

interface CanvasShim {
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  style: Record<string, never>;
  addEventListener: () => void;
  removeEventListener: () => void;
  setAttribute: () => void;
  getContext: () => ExpoWebGLRenderingContext;
}

const disposeScene = (scene: THREE.Scene): void => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
};

const addPlayer = (scene: THREE.Scene, x: number, z: number, color: number): void => {
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.48, 4, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.78 }),
  );
  body.position.set(x, 0.48, z);
  scene.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xb98262, roughness: 0.9 }),
  );
  head.position.set(x, 0.98, z);
  scene.add(head);
};

/** Lightweight Three.js match scene. Geometry-only: no model or texture loading stalls. */
export function StadiumScene3D({ lastShot, onUnavailable, theme = 'classic' }: Props) {
  const colors = useColors();
  const shotRef = useRef(lastShot);
  const activeRef = useRef(true);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    shotRef.current = lastShot;
  }, [lastShot]);

  useEffect(
    () => () => {
      activeRef.current = false;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      try {
        activeRef.current = true;
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;
        const canvas: CanvasShim = {
          width,
          height,
          clientWidth: width,
          clientHeight: height,
          style: {},
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          setAttribute: () => undefined,
          getContext: () => gl,
        };
        const renderer = new THREE.WebGLRenderer({
          canvas: canvas as unknown as HTMLCanvasElement,
          context: gl as unknown as WebGLRenderingContext,
          antialias: false,
          alpha: false,
        });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const noir = theme === 'noir';
        const palette = noir
          ? {
              sky: 0x050806,
              grass: 0x233d22,
              ring: 0xb9f23d,
              boundary: 0xd5b56d,
              stand: 0x111814,
              crowd: 0xb9f23d,
            }
          : {
              sky: 0x07110d,
              grass: 0x176536,
              ring: 0x7bcf8f,
              boundary: 0xf1c75b,
              stand: 0x18233a,
              crowd: 0x4c9aff,
            };
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(palette.sky);
        scene.fog = new THREE.Fog(palette.sky, 14, 34);

        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
        camera.position.set(10.5, 7.2, 12.5);
        camera.lookAt(0, 0, 0);

        scene.add(new THREE.HemisphereLight(0xcce7ff, 0x153a21, 2.2));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
        keyLight.position.set(-6, 12, 7);
        scene.add(keyLight);

        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(11, 64),
          new THREE.MeshStandardMaterial({ color: palette.grass, roughness: 0.95 }),
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const outfieldRing = new THREE.Mesh(
          new THREE.RingGeometry(7.2, 7.28, 64),
          new THREE.MeshBasicMaterial({ color: palette.ring, side: THREE.DoubleSide }),
        );
        outfieldRing.rotation.x = -Math.PI / 2;
        outfieldRing.position.y = 0.015;
        scene.add(outfieldRing);

        const boundary = new THREE.Mesh(
          new THREE.RingGeometry(10.45, 10.62, 64),
          new THREE.MeshBasicMaterial({ color: palette.boundary, side: THREE.DoubleSide }),
        );
        boundary.rotation.x = -Math.PI / 2;
        boundary.position.y = 0.03;
        scene.add(boundary);

        const pitch = new THREE.Mesh(
          new THREE.PlaneGeometry(2.2, 12),
          new THREE.MeshStandardMaterial({ color: 0xb99a67, roughness: 1 }),
        );
        pitch.rotation.x = -Math.PI / 2;
        pitch.position.y = 0.04;
        scene.add(pitch);

        [-4.6, 4.6].forEach((z) => {
          const crease = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 0.035, 0.06),
            new THREE.MeshBasicMaterial({ color: 0xf4f0dd }),
          );
          crease.position.set(0, 0.075, z);
          scene.add(crease);
          [-0.22, 0, 0.22].forEach((x) => {
            const stump = new THREE.Mesh(
              new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6),
              new THREE.MeshStandardMaterial({ color: 0xf5d46a }),
            );
            stump.position.set(x, 0.34, z);
            scene.add(stump);
          });
        });

        const lowerStand = new THREE.Mesh(
          new THREE.TorusGeometry(13, 1.45, 8, 72),
          new THREE.MeshStandardMaterial({ color: palette.stand, roughness: 0.8 }),
        );
        lowerStand.rotation.x = Math.PI / 2;
        lowerStand.position.y = 0.75;
        scene.add(lowerStand);
        const crowdBand = new THREE.Mesh(
          new THREE.TorusGeometry(12.8, 0.18, 6, 96),
          new THREE.MeshBasicMaterial({ color: palette.crowd }),
        );
        crowdBand.rotation.x = Math.PI / 2;
        crowdBand.position.y = 1.9;
        scene.add(crowdBand);

        const fielders: [number, number][] = [
          [-4.5, -3.5],
          [4.4, -3.8],
          [-6.4, 1.2],
          [6.2, 1.7],
          [-3.4, 6.3],
          [3.8, 6.1],
          [0, -7.5],
          [-7.4, -1.4],
          [7.6, -1.2],
        ];
        fielders.forEach(([x, z]) => addPlayer(scene, x, z, 0x4c9aff));
        addPlayer(scene, 0, 4.15, 0xe8b332);
        addPlayer(scene, 0, -2.9, 0xe5484d);
        addPlayer(scene, 0, 5.25, 0x4c9aff);

        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0xe5484d, emissive: 0x4a0709 }),
        );
        ball.position.set(0, 0.2, 4.15);
        scene.add(ball);

        const trajectoryMaterial = new THREE.LineBasicMaterial({
          color: 0xf5cf65,
          transparent: true,
          opacity: 0.72,
        });
        const trajectory = new THREE.Line(new THREE.BufferGeometry(), trajectoryMaterial);
        scene.add(trajectory);

        let seenShot = -1;
        let shotStarted = 0;
        let shotDuration = 700;
        const shotStart = new THREE.Vector3(0, 0.22, 4.1);
        let shotEnd = shotStart.clone();
        let shotArc = 0.8;

        const setTrajectory = (shot: LastShot) => {
          const angle = (shot.angleDeg * Math.PI) / 180;
          const distance = Math.max(1.8, shot.reach * 10);
          shotEnd = new THREE.Vector3(
            Math.sin(angle) * distance,
            0.18,
            Math.cos(angle) * -distance + 4.1,
          );
          shotArc = shot.tone === 'six' ? 4.2 : shot.tone === 'four' ? 1.4 : 0.7;
          shotDuration = shot.tone === 'six' ? 900 : 620;
          const points: THREE.Vector3[] = [];
          for (let i = 0; i <= 24; i++) {
            const p = i / 24;
            points.push(
              new THREE.Vector3()
                .lerpVectors(shotStart, shotEnd, p)
                .setY(0.2 + Math.sin(Math.PI * p) * shotArc),
            );
          }
          trajectory.geometry.dispose();
          trajectory.geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = trajectory.material as THREE.LineBasicMaterial;
          material.color.set(
            shot.tone === 'wicket' ? 0xe5484d : shot.tone === 'six' ? 0xf5cf65 : 0x33d993,
          );
          material.opacity = 0.78;
          ball.position.copy(shotStart);
        };

        const startedAt = Date.now();
        const render = () => {
          if (!activeRef.current) {
            disposeScene(scene);
            renderer.dispose();
            return;
          }
          const now = Date.now();
          const shot = shotRef.current;
          if (shot && shot.key !== seenShot) {
            seenShot = shot.key;
            shotStarted = now;
            setTrajectory(shot);
          }
          if (shot && shotStarted > 0) {
            const progress = Math.min((now - shotStarted) / shotDuration, 1);
            ball.position.lerpVectors(shotStart, shotEnd, progress);
            ball.position.y = 0.2 + Math.sin(Math.PI * progress) * shotArc;
            (trajectory.material as THREE.LineBasicMaterial).opacity =
              0.78 * (1 - Math.max(0, progress - 0.72) / 0.28);
          }

          const elapsed = (now - startedAt) / 1000;
          const orbit = elapsed * 0.055;
          camera.position.x = 10.5 + Math.sin(orbit) * 1.15;
          camera.position.z = 12.5 + Math.cos(orbit) * 1.15;
          camera.lookAt(0, 0.25, 0);
          renderer.render(scene, camera);
          gl.endFrameEXP();
          frameRef.current = requestAnimationFrame(render);
        };
        render();
      } catch (error) {
        console.warn('[StadiumScene3D] GL initialization failed', error);
        onUnavailable?.();
      }
    },
    [onUnavailable, theme],
  );

  return (
    <View style={styles.container} accessibilityLabel="Live 3D cricket ground">
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <View pointerEvents="none" style={styles.badge}>
        <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
        <Text style={styles.badgeText}>LIVE 3D</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 190,
    overflow: 'hidden',
    backgroundColor: '#07110D',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(7, 8, 12, 0.78)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { color: '#FFFFFF', fontSize: fontSize.xs, fontWeight: fontWeight.black },
});
