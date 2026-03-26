import './tailwind.css';
import './index.css';
import React from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {IDataEntryPluginProps} from "./Plugin.types";
import {ExternalSourceForm} from "./Components/ExternalSourceForm";

const queryClient = new QueryClient();
const PluginInner = (propsFromParent: IDataEntryPluginProps) => {
    const { setFieldValue } = propsFromParent;

    return (
        <QueryClientProvider
            client={queryClient}
        >
            <div
                className={'bg-white w-lvw flex'}
            >
                <div
                    className={'w-full'}
                >
                    <ExternalSourceForm
                        setFieldValue={setFieldValue}
                    />
                </div>
            </div>
        </QueryClientProvider>
    )
}

export default PluginInner;
