import React from 'react'
import Plugin from "./Plugin";
import './tailwind.css';
import './index.css';

const MyApp = () => (
    <div className={classes.container}>
        <DataQuery query={query}>
            {({ error, loading, data }) => {
                if (error) {
                    return <span>ERROR</span>
                }
                if (loading) {
                    return <span>...</span>
                }
                return (
                    <>
                        <h1>
                            {i18n.t('Hello {{name}}', { name: data.me.name })}
                        </h1>
                        <p> Hello world</p>
                        <h3>{i18n.t('Welcome to DHIS2!')}</h3>
                    </>
                )
            }}
        </DataQuery>
    </div>
)

export default MyApp
