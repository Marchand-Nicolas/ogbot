{ pkgs, ... }: {
  systemd.services.starknet_id_og_bot = {
    description = "PROGRAMMESWAG";
    after = [ "network.target" ];

    serviceConfig = {
      Type = "simple";
      User = "root";
      ExecStart =
        "${pkgs.nodejs-18_x}/bin/node index";
      WorkingDirectory = "/home/nicolas/Desktop/Nico/starknetId/ogbot/";
      Restart = "on-failure";
    };

    wantedBy = [ "multi-user.target" ];
  };
}