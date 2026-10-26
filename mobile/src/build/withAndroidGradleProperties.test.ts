// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setGradleProperties } = require('../../plugins/withAndroidGradleProperties');

type Item = { type: 'property'; key: string; value: string } | { type: 'comment'; value: string };

// The shape of the Expo SDK 54 template's android/gradle.properties.
const TEMPLATE: Item[] = [
  { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m -XX:MaxMetaspaceSize=512m' },
  { type: 'comment', value: 'Use this property to specify which architecture you want to build.' },
  {
    type: 'property',
    key: 'reactNativeArchitectures',
    value: 'armeabi-v7a,arm64-v8a,x86,x86_64',
  },
  { type: 'property', key: 'newArchEnabled', value: 'true' },
];

const values = (items: Item[], key: string) =>
  items.filter((i) => i.type === 'property' && i.key === key).map((i) => i.value);

describe('withAndroidGradleProperties', () => {
  it('builds arm64-v8a only, replacing the template ABI list', () => {
    const out: Item[] = setGradleProperties(TEMPLATE);
    expect(values(out, 'reactNativeArchitectures')).toEqual(['arm64-v8a']);
  });

  it('gives Gradle an 8 GB heap, replacing the template value', () => {
    const out: Item[] = setGradleProperties(TEMPLATE);
    expect(values(out, 'org.gradle.jvmargs')).toEqual(['-Xmx8g -XX:MaxMetaspaceSize=1g']);
  });

  it('adds the properties when the file has none', () => {
    const out: Item[] = setGradleProperties([]);
    expect(values(out, 'reactNativeArchitectures')).toEqual(['arm64-v8a']);
    expect(values(out, 'org.gradle.jvmargs')).toHaveLength(1);
  });

  it('keeps every other property and comment', () => {
    const out: Item[] = setGradleProperties(TEMPLATE);
    expect(out).toContainEqual(TEMPLATE[1]);
    expect(out).toContainEqual(TEMPLATE[3]);
  });

  it('is idempotent across repeated prebuilds', () => {
    const once: Item[] = setGradleProperties(TEMPLATE);
    expect(setGradleProperties(once)).toEqual(once);
  });
});
