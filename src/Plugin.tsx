import React from 'react';
import { IFormFieldPluginProps } from './Plugin.types';

const Plugin = ({
    values,
    fieldsMetadata,
}: IFormFieldPluginProps) => {
    return (
        <div style={{ padding: 10, backgroundColor: 'lightblue' }}>
            <h1>Plugin</h1>


            <div style={{ padding: 10, border: '1px solid black' }}>
                <pre>
                    {JSON.stringify(values, null, 2)}
                </pre>
            </div>
        </div>
    )
}

export default Plugin