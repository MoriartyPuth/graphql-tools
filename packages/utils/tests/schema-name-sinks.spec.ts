import { buildSchema, GraphQLEnumType, GraphQLObjectType } from 'graphql';
import { extractExtensionsFromSchema, MapperKind, mapSchema } from '../src/index.js';
import type { EnumTypeExtensions, ObjectTypeExtensions } from '../src/types.js';

/**
 * Defense-in-depth for the rebuild containers in mapSchema /
 * extractExtensionsFromSchema / rewireTypes.
 *
 * `__proto__` is a legal GraphQL Name: the Name grammar accepts it, and
 * graphql-js buildSchema accepts schema members named `__proto__` (they are
 * kept as own keys of graphql-js's null-prototype value maps). The rebuild
 * loops must therefore write such member names as ordinary own properties —
 * a plain `container[key] = value` resolves to the inherited
 * `Object.prototype.__proto__` setter instead, which hijacks the container's
 * [[Prototype]] and makes the member invisible to the Object.keys-based
 * rebuild (the member silently disappears from the mapped schema).
 */

describe('schema member names that match dangerous object keys', () => {
  const plainProtoOrNone = (obj: object) => {
    const proto = Object.getPrototypeOf(obj);
    return proto === Object.prototype || proto === null;
  };

  test('mapSchema preserves a field named __proto__ alongside sibling fields', () => {
    const schema = buildSchema(
      'type T { __proto__: String, keepMe: Int }\ntype Query { ok: String }',
    );
    const mapped = mapSchema(schema, { [MapperKind.FIELD]: config => config });
    const T = mapped.getType('T') as GraphQLObjectType;
    const fields = T.getFields();
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['__proto__', 'keepMe']));
    expect(Object.getOwnPropertyDescriptor(fields, '__proto__')).toBeDefined();
    expect(plainProtoOrNone(fields)).toBe(true);
  });

  test('mapSchema preserves an enum value named __proto__ alongside sibling values', () => {
    const schema = buildSchema('enum E { __proto__, KEEP }\ntype Query { ok: String }');
    const mapped = mapSchema(schema, { [MapperKind.ENUM_VALUE]: config => config });
    const E = mapped.getType('E') as GraphQLEnumType;
    const valueNames = E.getValues().map(value => value.name);
    expect(valueNames).toEqual(expect.arrayContaining(['__proto__', 'KEEP']));
  });

  test('mapSchema preserves an argument named __proto__ alongside sibling arguments', () => {
    const schema = buildSchema(
      'type T { f(__proto__: Int, keepArg: Int): String }\ntype Query { ok: String }',
    );
    const mapped = mapSchema(schema, { [MapperKind.ARGUMENT]: config => config });
    const T = mapped.getType('T') as GraphQLObjectType;
    // graphql-js v17 exposes field args as an array of GraphQLArgument,
    // v16 as a config map — assert the member names either way. Two members
    // present already proves the __proto__ write landed as an own key (a
    // prototype-setter write would have dropped it from Object.entries).
    const argsField = T.getFields()['f'] as unknown as {
      args: Array<{ name: string }> | Record<string, unknown>;
    };
    const argNames = Array.isArray(argsField.args)
      ? argsField.args.map(arg => arg.name)
      : Object.keys(argsField.args);
    expect(argNames).toEqual(expect.arrayContaining(['__proto__', 'keepArg']));
    if (!Array.isArray(argsField.args)) {
      expect(plainProtoOrNone(argsField.args)).toBe(true);
    }
  });

  test('mapSchema preserves a field renamed to __proto__ by a mapper', () => {
    const schema = buildSchema('type T { foo: String }\ntype Query { ok: String }');
    const mapped = mapSchema(schema, {
      [MapperKind.FIELD]: (config, fieldName) =>
        fieldName === 'foo' ? ['__proto__', config] : undefined,
    });
    const T = mapped.getType('T') as GraphQLObjectType;
    expect(Object.keys(T.getFields())).toContain('__proto__');
    expect(Object.getOwnPropertyDescriptor(T.getFields(), '__proto__')).toBeDefined();
  });

  test('a __proto__-named field survives the rewire pass of mapSchema', () => {
    const schema = buildSchema('type T { a: String }\ntype Query { __proto__: T, ok: T }');
    // Replacing T makes Query's field types stale, so rewireTypes rebuilds
    // Query's fields through rewireFields' containers.
    const mapped = mapSchema(schema, {
      [MapperKind.OBJECT_TYPE]: type =>
        type.name === 'T' ? new GraphQLObjectType({ ...type.toConfig() }) : type,
    });
    const Query = mapped.getType('Query') as GraphQLObjectType;
    const fieldNames = Object.keys(Query.getFields());
    expect(fieldNames).toEqual(expect.arrayContaining(['__proto__', 'ok']));
    expect(plainProtoOrNone(Query.getFields())).toBe(true);
  });

  test('extractExtensionsFromSchema keeps __proto__ members as own keys and does not hijack containers', () => {
    const schema = buildSchema(`
      type T { __proto__: String, keepMe: Int }
      type Query { t: T, f(__proto__: Int, keepArg: Int): String }
      enum E { __proto__, KEEP }
    `);
    const result = extractExtensionsFromSchema(schema, false);

    const enumValues = (result.types['E'] as EnumTypeExtensions).values;
    expect(Object.keys(enumValues)).toEqual(expect.arrayContaining(['__proto__', 'KEEP']));
    expect(Object.getOwnPropertyDescriptor(enumValues, '__proto__')).toBeDefined();
    expect(Object.getPrototypeOf(enumValues)).toBe(Object.prototype);

    const typeFields = (result.types['T'] as ObjectTypeExtensions).fields;
    expect(Object.keys(typeFields)).toEqual(expect.arrayContaining(['__proto__', 'keepMe']));
    expect(Object.getPrototypeOf(typeFields)).toBe(Object.prototype);

    const argumentExtensions = (result.types['Query'] as ObjectTypeExtensions).fields['f']
      .arguments;
    expect(Object.keys(argumentExtensions)).toEqual(
      expect.arrayContaining(['__proto__', 'keepArg']),
    );
    expect(Object.getPrototypeOf(argumentExtensions)).toBe(Object.prototype);
  });

  test('extractExtensionsFromSchema preserves a type named constructor (non-setter dangerous key)', () => {
    const schema = buildSchema('type constructor { a: String }\ntype Query { ok: String }');
    const mapped = mapSchema(schema, { [MapperKind.OBJECT_TYPE]: type => type });
    expect(mapped.getType('constructor')).not.toBeNull();

    const result = extractExtensionsFromSchema(schema, false);
    expect(Object.getOwnPropertyDescriptor(result.types, 'constructor')).toBeDefined();
  });
});
