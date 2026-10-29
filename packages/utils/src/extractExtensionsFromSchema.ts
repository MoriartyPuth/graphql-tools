import { GraphQLFieldConfig, GraphQLSchema } from 'graphql';
import { asArray } from './helpers.js';
import { MapperKind } from './Interfaces.js';
import { assignSafeObjectKey } from './jsutils.js';
import { mapSchema } from './mapSchema.js';
import {
  EnumTypeExtensions,
  InputTypeExtensions,
  ObjectTypeExtensions,
  SchemaExtensions,
} from './types.js';

function handleDirectiveExtensions(extensions: any, removeDirectives: boolean) {
  extensions = extensions || {};
  const { directives: existingDirectives, ...rest } = extensions;
  const finalExtensions: any = {
    ...rest,
  };
  // Object rest/spread already copies enumerable own symbols; this loop also picks
  // up non-enumerable ones (assignment makes them enumerable on the result).
  for (const sym of Object.getOwnPropertySymbols(extensions)) {
    finalExtensions[sym] = extensions[sym];
  }
  if (!removeDirectives) {
    if (existingDirectives != null) {
      const directives: Record<string, unknown> = {};
      for (const directiveName in existingDirectives) {
        assignSafeObjectKey(directives, directiveName, [
          ...asArray(existingDirectives[directiveName]),
        ]);
      }
      finalExtensions.directives = directives;
    }
  }
  return finalExtensions;
}

export function extractExtensionsFromSchema(
  schema: GraphQLSchema,
  removeDirectives = false,
): SchemaExtensions {
  const result: SchemaExtensions = {
    schemaExtensions: handleDirectiveExtensions(schema.extensions, removeDirectives),
    types: {},
  };
  const types = result.types;

  mapSchema(schema, {
    [MapperKind.OBJECT_TYPE]: type => {
      assignSafeObjectKey(types, type.name, {
        fields: {},
        type: 'object',
        extensions: handleDirectiveExtensions(type.extensions, removeDirectives),
      });
      return type;
    },
    [MapperKind.INTERFACE_TYPE]: type => {
      assignSafeObjectKey(types, type.name, {
        fields: {},
        type: 'interface',
        extensions: handleDirectiveExtensions(type.extensions, removeDirectives),
      });
      return type;
    },
    [MapperKind.FIELD]: (field, fieldName, typeName) => {
      const fields = (types[typeName] as ObjectTypeExtensions).fields;
      const fieldEntry = {
        arguments: {} as Record<string, unknown>,
        extensions: handleDirectiveExtensions(field.extensions, removeDirectives),
      };
      assignSafeObjectKey(fields, fieldName, fieldEntry);
      const args = (field as GraphQLFieldConfig<any, any>).args;
      if (args != null) {
        for (const argName in args) {
          assignSafeObjectKey(
            fieldEntry.arguments,
            argName,
            handleDirectiveExtensions(args[argName].extensions, removeDirectives),
          );
        }
      }
      return field;
    },
    [MapperKind.ENUM_TYPE]: type => {
      assignSafeObjectKey(types, type.name, {
        values: {},
        type: 'enum',
        extensions: handleDirectiveExtensions(type.extensions, removeDirectives),
      });
      return type;
    },
    [MapperKind.ENUM_VALUE]: (value, typeName, _schema, valueName) => {
      const values = (types[typeName] as EnumTypeExtensions).values;
      assignSafeObjectKey(
        values,
        valueName,
        handleDirectiveExtensions(value.extensions, removeDirectives),
      );
      return value;
    },
    [MapperKind.SCALAR_TYPE]: type => {
      assignSafeObjectKey(types, type.name, {
        type: 'scalar',
        extensions: handleDirectiveExtensions(type.extensions, removeDirectives),
      });
      return type;
    },
    [MapperKind.UNION_TYPE]: type => {
      assignSafeObjectKey(types, type.name, {
        type: 'union',
        extensions: handleDirectiveExtensions(type.extensions, removeDirectives),
      });
      return type;
    },
    [MapperKind.INPUT_OBJECT_TYPE]: type => {
      assignSafeObjectKey(types, type.name, {
        fields: {},
        type: 'input',
        extensions: handleDirectiveExtensions(type.extensions, removeDirectives),
      });
      return type;
    },
    [MapperKind.INPUT_OBJECT_FIELD]: (field, fieldName, typeName) => {
      const fields = (types[typeName] as InputTypeExtensions).fields;
      assignSafeObjectKey(fields, fieldName, {
        extensions: handleDirectiveExtensions(field.extensions, removeDirectives),
      });
      return field;
    },
  });

  return result;
}
