import { findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, i18n } from "@vendetta/metro/common";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";

const MessageStore = findByStoreName("MessageStore");
const UserStore = findByStoreName("UserStore");
const ChannelStore = findByStoreName("ChannelStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const ActionSheetRow = findByProps("ActionSheetRow")?.ActionSheetRow ?? Forms.FormRow;

let patches: (() => void)[] = [];

const generateFakeMessage = (userId: string, content: string, customUsername?: string, customAvatar?: string) => {
    const currentChannel = SelectedChannelStore.getChannelId();
    const channel = ChannelStore.getChannel(currentChannel);

    if (!channel || (channel as any).type !== 1) {
        alert("open a dm with the person frst");
        return;
    }

    const user = UserStore.getUser(userId);
    const fakeMessage = {
        id: `fake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 0,
        content: content,
        channel_id: currentChannel,
        author: {
            id: userId,
            username: customUsername || user?.username || "Unknown User",
            discriminator: user?.discriminator || "0001",
            avatar: customAvatar || user?.avatar || null,
            bot: false,
            system: false,
            public_flags: user?.publicFlags || 0,
            globalName: customUsername || user?.globalName || null
        },
        attachments: [],
        embeds: [],
        mentions: [],
        mention_roles: [],
        pinned: false,
        mention_everyone: false,
        tts: false,
        timestamp: new Date().toISOString(),
        edited_timestamp: null,
        flags: 0,
        components: [],
        referenced_message: null,
        interaction: null,
        webhookId: null,
        application: null,
        activity: null,
        nonce: null,
        otherPluginBypass: true
    };

    FluxDispatcher.dispatch({
        type: "MESSAGE_CREATE",
        channelId: currentChannel,
        message: fakeMessage,
        otherPluginBypass: true
    });
};

const Settings = () => {
    const [userId, setUserId] = React.useState("");
    const [messageContent, setMessageContent] = React.useState("");
    const [username, setUsername] = React.useState("");
    const [avatar, setAvatar] = React.useState("");

    const generateFakeMessage = () => {
        if (!userId || !messageContent) {
            alert("fill in user id nd msg content");
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        const dmChannels = ChannelStore.getSortedPrivateChannels();
        let dmChannel = dmChannels.find((channel: any) =>
            channel.type === 1 && channel.recipients?.includes(userId)
        );

        
        const channelId = dmChannel?.id || SelectedChannelStore.getChannelId() || `fake_dm_${userId}`;

        const fakeMessage = {
            id: `fake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 0,
            content: messageContent,
            channel_id: channelId,
            author: {
                id: userId,
                username: username || "Unknown User",
                discriminator: "0001",
                avatar: avatar || null,
                bot: false,
                system: false,
                public_flags: 0,
                globalName: username || null
            },
            attachments: [],
            embeds: [],
            mentions: [],
            mention_roles: [],
            pinned: false,
            mention_everyone: false,
            tts: false,
            timestamp: new Date().toISOString(),
            edited_timestamp: null,
            flags: 0,
            components: [],
            referenced_message: null,
            interaction: null,
            webhookId: null,
            application: null,
            activity: null,
            nonce: null,
            otherPluginBypass: true
        };

        FluxDispatcher.dispatch({
            type: "MESSAGE_CREATE",
            channelId: channelId,
            message: fakeMessage,
            otherPluginBypass: true
        });

        if (!dmChannel) {
            FluxDispatcher.dispatch({
                type: "CHANNEL_CREATE",
                channel: {
                    id: channelId,
                    type: 1,
                    recipients: [userId],
                    last_message_id: fakeMessage.id,
                    name: null,
                    icon: null,
                    owner_id: currentUser.id
                },
                otherPluginBypass: true
            });
        }

        alert("fake msg generated");
        setMessageContent("");
    };

    const loadUserInfo = () => {
        if (!userId) return;

        const user = UserStore.getUser(userId);
        if (user) {
            setUsername(user.username || user.globalName || "");
            setAvatar(user.avatar || "");
        }
    };

    return React.createElement(Forms.FormSection, { title: "Fake DM Generator" },
        React.createElement(Forms.FormText, {
            style: { marginBottom: 10 }
        }, "gen fake dms locally"),

        React.createElement(Forms.FormInput, {
            title: "User ID",
            value: userId,
            onChange: setUserId,
            placeholder: "enter user id"
        }),

        React.createElement(Forms.FormRow, {
            label: "Load User Info",
            trailing: React.createElement(Forms.FormButton, {
                text: "Load",
                onPress: loadUserInfo
            })
        }),

        React.createElement(Forms.FormInput, {
            title: "Username (optional)",
            value: username,
            onChange: setUsername,
            placeholder: "override user"
        }),

        React.createElement(Forms.FormInput, {
            title: "Avatar URL (optional)",
            value: avatar,
            onChange: setAvatar,
            placeholder: "av url"
        }),

        React.createElement(Forms.FormInput, {
            title: "Message Content",
            value: messageContent,
            onChange: setMessageContent,
            placeholder: "msg here"
        }),

        React.createElement(Forms.FormRow, {
            label: "gen fake dm",
            trailing: React.createElement(Forms.FormButton, {
                text: "Send",
                onPress: generateFakeMessage
            })
        }),

        React.createElement(Forms.FormDivider),

        React.createElement(Forms.FormText, {
            style: { marginTop: 10, fontSize: 12, opacity: 0.7 }
        }, "these are local only")
    );
};

export default {
    onLoad() {
        console.log("dm gen loaded");


        const MessageActions = findByProps("sendMessage", "editMessage");
        if (MessageActions) {
            patches.push(before("sendMessage", MessageActions, (args: any[]) => {
                const [channelId, message] = args;

                if (message?.content?.startsWith("!!fake ")) {
                    const channel = ChannelStore.getChannel(channelId);

                    if (!channel || (channel as any).type !== 1) return;

                    const otherUserId = (channel as any).recipients?.[0];
                    if (!otherUserId) return;

                    const fakeContent = message.content.substring(7); 
                    if (fakeContent.trim()) {
                        generateFakeMessage(otherUserId, fakeContent.trim());
                    }

                    return false;
                }
            }));
        }
    },

    onUnload() {
        patches.forEach(p => p());
        patches = [];
    },

    getSettingsComponent() {
        return Settings;
    }
};