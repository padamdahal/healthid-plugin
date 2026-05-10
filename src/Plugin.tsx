import React from 'react';
import { Button } from '@dhis2/ui';
import { IFormFieldPluginProps } from './Plugin.types';

const fetchExternalData = async () => {
    const response = await fetch('https://randomuser.me/api?inc=gender,name,dob&seed=1')
    const data = await response.json()
    return data
}

const Plugin = ({
    values,
    fieldsMetadata,
    setFieldValue
}: IFormFieldPluginProps) => {
    const fetchAndPopulate = async () => {
        const data = await fetchExternalData()

        setFieldValue({
            fieldId: 'firstName',
            value: data.results[0].name.first,
        });

        setFieldValue({
            fieldId: 'lastName',
            value: data.results[0].name.last,
        });
    };

    return (
        <div style={{ padding: 10, backgroundColor: 'lightblue' }}>
            <h1>Plugin Test</h1>

            <div style={{ padding: 10, border: '1px solid black' }}>
                <pre>
                    {JSON.stringify(values, null, 2)}
                </pre>
                <Button onClick={fetchAndPopulate}>
                    Search | खोज्नुहोस
                </Button>
            </div>
        </div>
    )
}

export default Plugin