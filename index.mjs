import http, { get } from 'http';
import axios from 'axios';
import dotenv from 'dotenv';
import { metafieldOwnerTypes } from './enums.mjs';
import {
    GET_METAOBJECT_DEFINITIONS_QUERY,
    ADD_METAOBJECT_DEFINITION_MUTATION,
    GET_METAFIELD_DEFINITIONS_QUERY,
    ADD_METAFIELD_DEFINITION_MUTATION
} from './queries.mjs';

dotenv.config();

const sourceStoreName = process.env.SOURCE_STORE_NAME;
const sourceStoreToken = process.env.SOURCE_STORE_TOKEN;
const targetStoreName = process.env.TARGET_STORE_NAME;
const targetStoreToken = process.env.TARGET_STORE_TOKEN;

const getMetaObjectDefinitions = async (storeName, storeToken) => {
    let after;
    let metaobjectDefinitions = [];
    
    while (true) {
        const res = await axios.post(
            `https://${storeName}.myshopify.com/admin/api/2024-10/graphql.json`,
            {
                query: GET_METAOBJECT_DEFINITIONS_QUERY,
                variables: {
                    after,
                    limit: 250
                }
            },
            {
                headers: {
                    'X-Shopify-Access-Token': storeToken,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = res.data.data.metaobjectDefinitions;

        metaobjectDefinitions = metaobjectDefinitions.concat(data.edges.map(edge => {
            return {
                ...edge.node,
                fieldDefinitions: edge.node.fieldDefinitions.map(field => {
                    return {
                        ...field,
                        type: field.type.name
                    }
                })
            }
        }));

        if (!data.pageInfo.hasNextPage) {
            break;
        }

        after = data.pageInfo.endCursor;
    }

    console.log(`Fetched ${metaobjectDefinitions.length} metaobject definitions`);

    return metaobjectDefinitions;
};

const addMetaObjectDefinition = async (definition) => {
    const res = await axios.post(
        `https://${targetStoreName}.myshopify.com/admin/api/2024-10/graphql.json`,
        {
            query: ADD_METAOBJECT_DEFINITION_MUTATION,
            variables: {
                definition
            }
        },
        {
            headers: {
                'X-Shopify-Access-Token': targetStoreToken,
                'Content-Type': 'application/json'
            }
        }
    );

    return res.data;
}

const addMetaObjectDefinitions = async (definitions) => {
    const resData = [];

    for (const definition of definitions) {
        const res = await addMetaObjectDefinition(definition);

        resData.push(res);
    }

    return resData;
}  

const migrateMetaObjectDefinitions = async () => {
    const definitions = await getMetaObjectDefinitions(sourceStoreName, sourceStoreToken);
    const resData = await addMetaObjectDefinitions(definitions);

    return resData;
}

const getMetaFieldDefinitions = async (ownerType, storeName, storeToken) => {
    let after;
    let metafieldDefinitions = [];
    
    while (true) {
        const res = await axios.post(
            `https://${storeName}.myshopify.com/admin/api/2024-10/graphql.json`,
            {
                query: GET_METAFIELD_DEFINITIONS_QUERY,
                variables: {
                    limit: 10,
                    after,
                    ownerType
                }
            },
            {
                headers: {
                    'X-Shopify-Access-Token': storeToken,
                    'Content-Type': 'application/json'
                }
            }
        );

        // console.log('[res]', res.data.errors);

        const data = res.data.data.metafieldDefinitions;

        metafieldDefinitions = metafieldDefinitions.concat(data.edges.map(edge => {
            return {
                ...edge.node,
                type: edge.node.type.name
            }
        }));

        if (!data.pageInfo.hasNextPage) {
            break;
        }

        after = data.pageInfo.endCursor;
    }

    console.log(`Fetched ${metafieldDefinitions.length} metafield definitions`);

    return metafieldDefinitions;
}

const addMetaFieldDefinition = async (definition) => {
    const res = await axios.post(
        `https://${targetStoreName}.myshopify.com/admin/api/2024-10/graphql.json`,
        {
            query: ADD_METAFIELD_DEFINITION_MUTATION,
            variables: {
                definition
            }
        },
        {
            headers: {
                'X-Shopify-Access-Token': targetStoreToken,
                'Content-Type': 'application/json'
            }
        }
    );

    return res.data;
}

const addMetaFieldDefinitions = async (definitions) => {
    const resData = [];

    for (const definition of definitions) {
        const res = await addMetaFieldDefinition(definition);

        resData.push(res);
    }

    return resData;
}

const getMetaObjectIdsMap = async () => {
    const metaObjectsFromSourceStore = await getMetaObjectDefinitions(sourceStoreName, sourceStoreToken);
    const metaObjectsFromTargetStore = await getMetaObjectDefinitions(targetStoreName, targetStoreToken);

    const metaObjectIdsMap = {};

    for (const metaObject of metaObjectsFromSourceStore) {
        const targetMetaObject = metaObjectsFromTargetStore.find(obj => obj.type === metaObject.type);

        if (targetMetaObject) {
            metaObjectIdsMap[metaObject.id] = targetMetaObject.id;
        }
    }

    return metaObjectIdsMap;
}

const migrateMetaFieldDefinitions = async () => {
    let resData = [];
    const ownerTypes = Object.values(metafieldOwnerTypes);

    const metaObjectIdsMap = await getMetaObjectIdsMap();

    for (const ownerType of ownerTypes) {
        const definitions = await getMetaFieldDefinitions(ownerType, sourceStoreName, sourceStoreToken);
        const updatedDefinitions = definitions.map(definition => {
            const publicReturn = {
                name: definition.name,
                key: definition.key,
                namespace: definition.namespace,
                description: definition.description,
                ownerType: definition.ownerType,
                type: definition.type,
                validations: definition.validations
            };

            if (definition.type === 'metaobject_reference' || definition.type === 'list.metaobject_reference') {
                return {
                    ...publicReturn,
                    validations: definition.validations.map(validation => {
                        if (validation.name === 'metaobject_definition_id') {
                            return {
                                ...validation,
                                value: metaObjectIdsMap[validation.value]
                            }
                        }

                        return validation;
                    }),
                    pin: definition.pinnedPosition > 0 || false
                }
            }
            
            return {
                ...publicReturn,
                pin: definition.pinnedPosition > 0 || false
            };
        });
        
        const res = await addMetaFieldDefinitions(updatedDefinitions);

        resData = resData.concat(res);
    }

    return resData;
}

const server = http.createServer(async (req, res) => {
    try {
        // const resData = await migrateMetaObjectDefinitions();
        // const resData = await getMetaObjectDefinitions(targetStoreName, targetStoreToken);
        // const resData = await getMetaFieldDefinitions('PRODUCT', sourceStoreName, sourceStoreToken);
        // const resData = await getMetaObjectIdsMap();
        const resData = await migrateMetaFieldDefinitions();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify(resData));
        res.end();
    }
    catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify({ error: err.message }));
        res.end();
    }
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});