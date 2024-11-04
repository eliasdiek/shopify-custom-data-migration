const GET_METAOBJECT_DEFINITIONS_QUERY = `
query getMetaObjectDefinitions($after: String, $limit: Int!) {
  metaobjectDefinitions(first: $limit,  after: $after) {
    edges {
      node {
        id
        name
        type
        description
        displayNameKey
        fieldDefinitions {
          name
          key
          description
          required
          type {
            name
            category
          }
          validations {
            name
            value
          }
        }
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
`;

const ADD_METAOBJECT_DEFINITION_MUTATION = `
mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
  metaobjectDefinitionCreate(definition: $definition) {
    metaobjectDefinition {
      name
      type
      fieldDefinitions {
        name
        key
      }
    }
    userErrors {
      field
      message
      code
    }
  }
}
`;

const GET_METAFIELD_DEFINITIONS_QUERY = `
query getMetafieldDefinitions($limit: Int!, $after: String, $ownerType: MetafieldOwnerType!) {
  metafieldDefinitions(first: $limit, after: $after, ownerType: $ownerType) {
    edges {
      node {
        name
        key
        namespace
        description
        pinnedPosition
        ownerType
        type {
          name
          category
        }
        validations {
          name
          value
        }
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
`;

const ADD_METAFIELD_DEFINITION_MUTATION = `
mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition {
      id
      name
    }
    userErrors {
      field
      message
      code
    }
  }
}
`;

export {
    GET_METAOBJECT_DEFINITIONS_QUERY,
    ADD_METAOBJECT_DEFINITION_MUTATION,
    GET_METAFIELD_DEFINITIONS_QUERY,
    ADD_METAFIELD_DEFINITION_MUTATION
};